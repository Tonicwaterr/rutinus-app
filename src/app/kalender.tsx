import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { TaskDetailModal } from '../components/task-detail-modal';

const STORAGE_KEY = 'uppgifter';
const EDIT_REQUEST_KEY = 'rutinus-edit-request';

type UpprepningsRegel = {
  typ: 'daglig' | 'veckovis' | 'manadsvis';
  dagar?: number;
  veckoFrekvens?: string;
  veckodag?: string;
  manadsFrekvens?: string;
  manadsDag?: number;
  manadsDynamisk?: boolean;
  manadsPosition?: string;
  manadsDynamiskVeckodag?: string;
  manadsDynamiskFrekvens?: string;
};

type Uppgift = {
  id: string;
  titel: string;
  status: 'aktiv' | 'avslutad';
  datum: string;
  klartDatum?: string;
  kommentar?: string;
  arViktig?: boolean;
  harStartTid?: boolean;
  startTid?: string;
  upprepningar?: UpprepningsRegel[];
};

const svenskaManader = [
  'Januari',
  'Februari',
  'Mars',
  'April',
  'Maj',
  'Juni',
  'Juli',
  'Augusti',
  'September',
  'Oktober',
  'November',
  'December',
];

const svenskaVeckodagarKort = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

function strangTillDatum(datumStrang: string) {
  const [ar, manad, dag] = datumStrang.split('-').map(Number);
  return new Date(ar, manad - 1, dag);
}

function datumTillStrang(datum: Date) {
  const ar = datum.getFullYear();
  const manad = String(datum.getMonth() + 1).padStart(2, '0');
  const dag = String(datum.getDate()).padStart(2, '0');
  return `${ar}-${manad}-${dag}`;
}

function formatVisaDatum(datumStrang: string) {
  const datum = strangTillDatum(datumStrang);
  return `${datum.getDate()} ${svenskaManader[datum.getMonth()]}`;
}

function formatVisaTid(uppgift: Uppgift) {
  if (!uppgift.harStartTid || !uppgift.startTid) {
    return '';
  }

  return uppgift.startTid;
}

function hamtaManadsGrid(visatDatum: Date) {
  const ar = visatDatum.getFullYear();
  const manad = visatDatum.getMonth();

  const forstaDagen = new Date(ar, manad, 1);
  const sistaDagen = new Date(ar, manad + 1, 0);

  const antalDagar = sistaDagen.getDate();

  let startIndex = forstaDagen.getDay() - 1;
  if (startIndex < 0) {
    startIndex = 6;
  }

  const rutor: Array<{ datum: Date | null }> = [];

  for (let i = 0; i < startIndex; i++) {
    rutor.push({ datum: null });
  }

  for (let dag = 1; dag <= antalDagar; dag++) {
    rutor.push({ datum: new Date(ar, manad, dag) });
  }

  while (rutor.length % 7 !== 0) {
    rutor.push({ datum: null });
  }

  return rutor;
}

function formatVeckoFrekvensText(frekvens?: string) {
  switch (frekvens) {
    case 'Varje':
      return 'varje';
    case 'Varannan':
      return 'varannan';
    case 'Var 3e':
      return 'var 3e';
    case 'Var 4e':
      return 'var 4e';
    case 'Var 5e':
      return 'var 5e';
    case 'Var 6e':
      return 'var 6e';
    default:
      return '';
  }
}

function formatManadsFrekvensText(frekvens?: string) {
  switch (frekvens) {
    case 'Varje':
      return 'varje månad';
    case 'Varannan':
      return 'varannan månad';
    case 'Var 3e':
      return 'var 3e månad';
    case 'Var 4e':
      return 'var 4e månad';
    case 'Var 5e':
      return 'var 5e månad';
    case 'Var 6e':
      return 'var 6e månad';
    default:
      return '';
  }
}

function formatVeckodagBestamdForm(dag?: string) {
  switch (dag) {
    case 'Måndag':
      return 'måndagen';
    case 'Tisdag':
      return 'tisdagen';
    case 'Onsdag':
      return 'onsdagen';
    case 'Torsdag':
      return 'torsdagen';
    case 'Fredag':
      return 'fredagen';
    case 'Lördag':
      return 'lördagen';
    case 'Söndag':
      return 'söndagen';
    default:
      return '';
  }
}

function formatManadsDagText(dag?: number) {
  if (!dag) {
    return '';
  }

  if (dag === 1) {
    return '1a';
  }

  return `${dag}e`;
}

function formatUpprepningTextFranRegel(regel: UpprepningsRegel) {
  if (regel.typ === 'daglig') {
    const dagar = regel.dagar ?? 1;

    if (dagar === 1) {
      return 'Upprepas varje dag';
    }

    if (dagar === 2) {
      return 'Upprepas varannan dag';
    }

    return `Upprepas var ${dagar} dagar`;
  }

  if (regel.typ === 'veckovis') {
    const frekvensText = formatVeckoFrekvensText(regel.veckoFrekvens);
    const veckodag = regel.veckodag?.toLowerCase() ?? '';
    return `Upprepas ${frekvensText} ${veckodag}`.trim();
  }

  if (regel.typ === 'manadsvis') {
    if (regel.manadsDynamisk) {
      const position = regel.manadsPosition?.toLowerCase() ?? '';
      const veckodag = formatVeckodagBestamdForm(regel.manadsDynamiskVeckodag);
      const frekvensText = formatManadsFrekvensText(regel.manadsDynamiskFrekvens);

      return `Upprepas den ${position} ${veckodag} ${frekvensText}`.trim();
    }

    const dagText = formatManadsDagText(regel.manadsDag);
    const frekvensText = formatManadsFrekvensText(regel.manadsFrekvens);

    return `Upprepas den ${dagText} ${frekvensText}`.trim();
  }

  return 'Ingen upprepning';
}

function formatDetaljDatum(uppgift: Uppgift) {
  const datum = strangTillDatum(uppgift.datum);
  const veckodagar = [
    'Söndag',
    'Måndag',
    'Tisdag',
    'Onsdag',
    'Torsdag',
    'Fredag',
    'Lördag',
  ];
  const manad = svenskaManader[datum.getMonth()];
  return `${veckodagar[datum.getDay()]} ${datum.getDate()} ${manad}`;
}

function hamtaFrekvensNummer(frekvens?: string) {
  switch (frekvens) {
    case 'Varje':
      return 1;
    case 'Varannan':
      return 2;
    case 'Var 3e':
      return 3;
    case 'Var 4e':
      return 4;
    case 'Var 5e':
      return 5;
    case 'Var 6e':
      return 6;
    default:
      return 1;
  }
}

function hamtaVeckodagNummer(dag?: string) {
  switch (dag) {
    case 'Söndag':
      return 0;
    case 'Måndag':
      return 1;
    case 'Tisdag':
      return 2;
    case 'Onsdag':
      return 3;
    case 'Torsdag':
      return 4;
    case 'Fredag':
      return 5;
    case 'Lördag':
      return 6;
    default:
      return 1;
  }
}

function hamtaSistaVeckodagIManad(ar: number, manad: number, veckodag: number) {
  const sistaDatum = new Date(ar, manad + 1, 0);

  while (sistaDatum.getDay() !== veckodag) {
    sistaDatum.setDate(sistaDatum.getDate() - 1);
  }

  return sistaDatum;
}

function hamtaForstaVeckodagIManad(ar: number, manad: number, veckodag: number) {
  const forstaDatum = new Date(ar, manad, 1);

  while (forstaDatum.getDay() !== veckodag) {
    forstaDatum.setDate(forstaDatum.getDate() + 1);
  }

  return forstaDatum;
}

function beraknaNastaDatumFranRegel(utgangsDatum: string, regel: UpprepningsRegel) {
  const aktuelltDatum = strangTillDatum(utgangsDatum);

  if (regel.typ === 'daglig') {
    const dagar = regel.dagar ?? 1;
    const nyttDatum = new Date(aktuelltDatum);
    nyttDatum.setDate(nyttDatum.getDate() + dagar);
    return datumTillStrang(nyttDatum);
  }

  if (regel.typ === 'veckovis') {
    const stegVeckor = hamtaFrekvensNummer(regel.veckoFrekvens);
    const malVeckodag = hamtaVeckodagNummer(regel.veckodag);

    const nyttDatum = new Date(aktuelltDatum);
    nyttDatum.setDate(nyttDatum.getDate() + stegVeckor * 7);

    while (nyttDatum.getDay() !== malVeckodag) {
      nyttDatum.setDate(nyttDatum.getDate() + 1);
    }

    return datumTillStrang(nyttDatum);
  }

  if (regel.typ === 'manadsvis') {
    if (regel.manadsDynamisk) {
      const stegManader = hamtaFrekvensNummer(regel.manadsDynamiskFrekvens);
      const malVeckodag = hamtaVeckodagNummer(regel.manadsDynamiskVeckodag);

      const nyttAr = aktuelltDatum.getFullYear();
      const nyManad = aktuelltDatum.getMonth() + stegManader;

      let nyttDatum: Date;

      if (regel.manadsPosition === 'Sista') {
        nyttDatum = hamtaSistaVeckodagIManad(nyttAr, nyManad, malVeckodag);
      } else {
        nyttDatum = hamtaForstaVeckodagIManad(nyttAr, nyManad, malVeckodag);
      }

      return datumTillStrang(nyttDatum);
    }

    const stegManader = hamtaFrekvensNummer(regel.manadsFrekvens);
    const manadsDag = regel.manadsDag ?? 1;

    const nyttAr = aktuelltDatum.getFullYear();
    const nyManad = aktuelltDatum.getMonth() + stegManader;

    const maxDag = new Date(nyttAr, nyManad + 1, 0).getDate();
    const giltigDag = Math.min(manadsDag, maxDag);

    const nyttDatum = new Date(nyttAr, nyManad, giltigDag);
    return datumTillStrang(nyttDatum);
  }

  return utgangsDatum;
}

export default function KalenderScreen() {
  const idag = new Date();
  const router = useRouter();

  const [uppgifter, setUppgifter] = useState<Uppgift[]>([]);
  const [visatDatum, setVisatDatum] = useState(
    new Date(idag.getFullYear(), idag.getMonth(), 1)
  );
  const [valtDatumStrang, setValtDatumStrang] = useState(datumTillStrang(idag));
  const [valdUppgift, setValdUppgift] = useState<Uppgift | null>(null);
  
  const [visaViktigBekraftelse, setVisaViktigBekraftelse] = useState(false);
  const [uppgiftAttFlytta, setUppgiftAttFlytta] = useState<Uppgift | null>(null);

  async function sparaOchSattUppgifterKalender(nyaUppgifter: Uppgift[]) {
    setUppgifter(nyaUppgifter);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nyaUppgifter));

      const kontroll = await AsyncStorage.getItem(STORAGE_KEY);
      const kontrollLista: Uppgift[] = kontroll ? JSON.parse(kontroll) : [];

      console.log('Kalender sparade antal uppgifter:', kontrollLista.length);
      console.log(
        'Kalender sparade statusar:',
        kontrollLista.map((uppgift) => ({
          id: uppgift.id,
          titel: uppgift.titel,
          status: uppgift.status,
          datum: uppgift.datum,
          klartDatum: uppgift.klartDatum,
        }))
      );
    } catch (error) {
      console.log('Kunde inte spara uppgifter i kalendern:', error);
    }
  }

  const laddaUppgifter = useCallback(async () => {
    try {
      const sparadeUppgifter = await AsyncStorage.getItem(STORAGE_KEY);

      if (sparadeUppgifter) {
        setUppgifter(JSON.parse(sparadeUppgifter));
      } else {
        setUppgifter([]);
      }
    } catch (error) {
      console.log('Kunde inte läsa uppgifter i kalendern:', error);
    }
  }, []);
  
  useEffect(() => {
    laddaUppgifter();
  }, [laddaUppgifter]);

  useFocusEffect(
    useCallback(() => {
      laddaUppgifter();
    }, [laddaUppgifter])
  );

  const grid = useMemo(() => hamtaManadsGrid(visatDatum), [visatDatum]);

  const aktivaUppgifterPerDatum = useMemo(() => {
    const map = new Map<string, Uppgift[]>();

    for (const uppgift of uppgifter) {
      if (uppgift.status !== 'aktiv') {
        continue;
      }

      if (!map.has(uppgift.datum)) {
        map.set(uppgift.datum, []);
      }

      map.get(uppgift.datum)?.push(uppgift);
    }

    return map;
  }, [uppgifter]);

  const uppgifterForValtDatum = useMemo(() => {
    const lista = uppgifter.filter((uppgift) => uppgift.datum === valtDatumStrang);

    return [...lista].sort((a, b) => {
      // 1. Completed tasks go to the bottom
      if (a.status !== b.status) {
        if (a.status === 'avslutad') {
          return 1;
        }
        if (b.status === 'avslutad') {
          return -1;
        }
      }

      // 2. Important tasks come first
      if ((a.arViktig ?? false) !== (b.arViktig ?? false)) {
        return a.arViktig ? -1 : 1;
      }

      // 3. Tasks with time come before tasks without time
      const aHarTid = a.harStartTid && a.startTid;
      const bHarTid = b.harStartTid && b.startTid;

      if (aHarTid && bHarTid) {
        return a.startTid!.localeCompare(b.startTid!);
      }

      if (aHarTid) {
        return -1;
      }

      if (bHarTid) {
        return 1;
      }

      // 4. Fallback: alphabetical
      return a.titel.localeCompare(b.titel);
    });
  }, [uppgifter, valtDatumStrang]);

  function gaTillForraManaden() {
    setVisatDatum(
      new Date(visatDatum.getFullYear(), visatDatum.getMonth() - 1, 1)
    );
  }

  function gaTillNastaManaden() {
    setVisatDatum(
      new Date(visatDatum.getFullYear(), visatDatum.getMonth() + 1, 1)
    );
  }

  function oppnaUppgift(uppgift: Uppgift) {
    setValdUppgift(uppgift);
  }

  function stangUppgift() {
    setValdUppgift(null);
  }

  async function redigeraFranKalender() {
    if (!valdUppgift) {
      return;
    }

    try {
      await AsyncStorage.setItem(EDIT_REQUEST_KEY, valdUppgift.id);
    } catch (error) {
      console.log('Kunde inte spara redigeringsförfrågan:', error);
    }

    stangUppgift();

    requestAnimationFrame(() => {
      router.push('/');
    });
  }

  async function markeraUppgiftSomKlar(uppgiftAttSlutfora: Uppgift) {
    const avslutadIdag = datumTillStrang(new Date());

    const uppdateradUppgift: Uppgift = {
      ...uppgiftAttSlutfora,
      status: 'avslutad',
      klartDatum: avslutadIdag,
    };

    let nyaFramtidaUppgifter: Uppgift[] = [];

    if (uppgiftAttSlutfora.upprepningar && uppgiftAttSlutfora.upprepningar.length > 0) {
      nyaFramtidaUppgifter = uppgiftAttSlutfora.upprepningar.map((regel, index) => ({
        ...uppgiftAttSlutfora,
        id: `${Date.now()}-${index}`,
        status: 'aktiv',
        datum: beraknaNastaDatumFranRegel(uppgiftAttSlutfora.datum, regel),
        klartDatum: undefined,
        upprepningar: [regel],
      }));
    }

    const uppdaterade = uppgifter.map((uppgift) =>
      uppgift.id === uppgiftAttSlutfora.id ? uppdateradUppgift : uppgift
    );

    const slutligLista =
      nyaFramtidaUppgifter.length > 0
        ? [...nyaFramtidaUppgifter, ...uppdaterade]
        : uppdaterade;

    await sparaOchSattUppgifterKalender(slutligLista);
  }

  async function hanteraKlarFranDetalj() {
    if (!valdUppgift) {
      return;
    }

    await markeraUppgiftSomKlar(valdUppgift);
    stangUppgift();
  }

  async function flyttaUppgiftTillImorgon(uppgift: Uppgift) {
    const nuvarandeDatum = strangTillDatum(uppgift.datum);
    const imorgon = new Date(nuvarandeDatum);
    imorgon.setDate(imorgon.getDate() + 1);

    const nyttDatum = datumTillStrang(imorgon);

    const nyaUppgifter = uppgifter.map((nuvarandeUppgift) =>
      nuvarandeUppgift.id === uppgift.id
        ? {
            ...nuvarandeUppgift,
            datum: nyttDatum,
          }
        : nuvarandeUppgift
    );

    await sparaOchSattUppgifterKalender(nyaUppgifter);
  }

  async function bekraftaFlyttaTillImorgon() {
    if (!uppgiftAttFlytta) {
      return;
    }

    await flyttaUppgiftTillImorgon(uppgiftAttFlytta);

    setUppgiftAttFlytta(null);
    setVisaViktigBekraftelse(false);
  }

  function avbrytFlyttaTillImorgon() {
    setUppgiftAttFlytta(null);
    setVisaViktigBekraftelse(false);
  }

  async function hanteraFlyttaTillImorgonFranDetalj() {
    if (!valdUppgift) {
      return;
    }

    if (valdUppgift.arViktig) {
      const uppgift = valdUppgift;
      stangUppgift();

      setTimeout(() => {
        setUppgiftAttFlytta(uppgift);
        setVisaViktigBekraftelse(true);
      }, 50);

      return;
    }

    await flyttaUppgiftTillImorgon(valdUppgift);
    stangUppgift();
  }

  async function hoppaOverUppgift(uppgift: Uppgift) {
    if (!uppgift.upprepningar || uppgift.upprepningar.length === 0) {
      await flyttaUppgiftTillImorgon(uppgift);
      return;
    }

    const regel = uppgift.upprepningar[0];

    if (!regel) {
      await flyttaUppgiftTillImorgon(uppgift);
      return;
    }

    const nyttDatum = beraknaNastaDatumFranRegel(uppgift.datum, regel);

    const nyaUppgifter = uppgifter.map((nuvarandeUppgift) =>
      nuvarandeUppgift.id === uppgift.id
        ? {
            ...nuvarandeUppgift,
            datum: nyttDatum,
          }
        : nuvarandeUppgift
    );

    await sparaOchSattUppgifterKalender(nyaUppgifter);
  }

  async function hanteraHoppaOverFranDetalj() {
    if (!valdUppgift) {
      return;
    }

    await hoppaOverUppgift(valdUppgift);
    stangUppgift();
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.monthHeader}>
        <Pressable style={styles.monthButton} onPress={gaTillForraManaden}>
          <Text style={styles.monthButtonText}>‹</Text>
        </Pressable>

        <Text style={styles.monthTitle}>
          {svenskaManader[visatDatum.getMonth()]} {visatDatum.getFullYear()}
        </Text>

        <Pressable style={styles.monthButton} onPress={gaTillNastaManaden}>
          <Text style={styles.monthButtonText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {svenskaVeckodagarKort.map((dag) => (
          <Text key={dag} style={styles.weekdayText}>
            {dag}
          </Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {grid.map((ruta, index) => {
          if (!ruta.datum) {
            return (
              <View key={index} style={styles.dayCellWrapper}>
                <View style={styles.emptyDayCell} />
              </View>
            );
          }

          const datumStrang = datumTillStrang(ruta.datum);
          const harUppgifter = (aktivaUppgifterPerDatum.get(datumStrang)?.length ?? 0) > 0;
          const arVald = datumStrang === valtDatumStrang;

          return (
            <View key={datumStrang} style={styles.dayCellWrapper}>
              <Pressable
                style={[
                  styles.dayCell,
                  harUppgifter && styles.dayCellWithTasks,
                  arVald && styles.dayCellSelected,
                ]}
                onPress={() => setValtDatumStrang(datumStrang)}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    arVald && styles.dayNumberSelected,
                  ]}
                >
                  {ruta.datum.getDate()}
                </Text>

                {harUppgifter && <View style={styles.dayDot} />}
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={styles.selectedSection}>
        <Text style={styles.selectedTitle}>
          {formatVisaDatum(valtDatumStrang)}
        </Text>

        {uppgifterForValtDatum.length === 0 ? (
          <Text style={styles.emptyText}>Inga uppgifter denna dag</Text>
        ) : (
          uppgifterForValtDatum.map((uppgift) => (
            <Pressable
              key={uppgift.id}
              onPress={() => oppnaUppgift(uppgift)}
              style={[
                styles.taskCard,
                uppgift.status === 'avslutad' && styles.completedTaskCard,
              ]}
            >
              <View style={styles.taskTopRow}>
                <Text
                  style={[
                    styles.taskTitle,
                    uppgift.status === 'avslutad' && styles.completedTaskTitle,
                  ]}
                >
                  {uppgift.status === 'avslutad' ? '✔ ' : ''}
                  {uppgift.titel}
                </Text>

                {uppgift.harStartTid && uppgift.startTid ? (
                  <Text style={styles.taskTime}>{formatVisaTid(uppgift)}</Text>
                ) : null}
              </View>

            </Pressable>
          ))
        )}
      </View>
      
      <TaskDetailModal
        uppgift={valdUppgift}
        visible={valdUppgift !== null}
        onClose={stangUppgift}
        onComplete={hanteraKlarFranDetalj}
        onEdit={redigeraFranKalender}
        onSkip={hanteraHoppaOverFranDetalj}
        onMoveToTomorrow={hanteraFlyttaTillImorgonFranDetalj}
        formatDetaljDatum={formatDetaljDatum}
        formatUpprepningTextFranRegel={formatUpprepningTextFranRegel}
      />

      <Modal
        visible={visaViktigBekraftelse}
        animationType="fade"
        transparent={true}
        onRequestClose={avbrytFlyttaTillImorgon}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationCard}>
            <Text style={styles.confirmationText}>
              Uppgiften är markerad som viktig. Är du säker på att du vill flytta fram den?
            </Text>

            <View style={styles.confirmationButtonRow}>
              <Pressable style={styles.cancelButton} onPress={avbrytFlyttaTillImorgon}>
                <Text style={styles.cancelButtonText}>Nej</Text>
              </Pressable>

              <Pressable style={styles.confirmButton} onPress={bekraftaFlyttaTillImorgon}>
                <Text style={styles.confirmButtonText}>Ja</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
    marginTop: 30,
  },

  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  monthButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e9ecef',
    alignItems: 'center',
    justifyContent: 'center',
  },

  monthButtonText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#222',
  },

  monthTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },

  weekdayRow: {
    flexDirection: 'row',
  },

  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
  },

  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  dayCellWrapper: {
    width: '14.2857%',
    padding: 4,
  },

  dayCell: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyDayCell: {
    width: '100%',
    aspectRatio: 1,
  },

  dayCellWithTasks: {
    backgroundColor: '#e8f0ff',
  },

  dayCellSelected: {
    backgroundColor: '#1f6feb',
  },

  dayNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },

  dayNumberSelected: {
    color: '#fff',
  },

  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1f6feb',
    marginTop: 4,
  },

  selectedSection: {
    gap: 10,
  },

  selectedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },

  emptyText: {
    fontSize: 15,
    color: '#666',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    padding: 20,
  },

  taskCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },

  completedTaskCard: {
    backgroundColor: '#e0e0e0',
  },

  taskTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },

  taskTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },

  completedTaskTitle: {
    color: '#666',
  },

  taskTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
  },

  confirmationCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    gap: 16,
  },

  confirmationText: {
    fontSize: 16,
    color: '#222',
    lineHeight: 22,
  },

  confirmationButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },

  cancelButton: {
    flex: 1,
    backgroundColor: '#e9ecef',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },

  cancelButtonText: {
    color: '#222',
    fontWeight: '600',
  },

  confirmButton: {
    flex: 1,
    backgroundColor: '#1f6feb',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },

  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

});