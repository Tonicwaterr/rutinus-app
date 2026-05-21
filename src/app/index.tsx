import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useEffect, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { TaskDetailModal } from '../components/task-detail-modal';


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
  datum: string; // YYYY-MM-DD
  klartDatum?: string;
  kommentar?: string;
  arViktig?: boolean;

  startTid?: string;
  harStartTid?: boolean;

  upprepningar?: UpprepningsRegel[];
  
};

type Flik = 'Idag' | 'Framtida';

type UppgiftsSektionProps = {
  uppgifter: Uppgift[];
  onTryckUppgift?: (id: string) => void;
  kanSwipeFlytta?: boolean;
  onSwipeFlytta?: (uppgift: Uppgift) => void;
  swipeResetCounter?: number;
};

const STORAGE_KEY = 'uppgifter';

function datumTillStrang(datum: Date) {
  const ar = datum.getFullYear();
  const manad = String(datum.getMonth() + 1).padStart(2, '0');
  const dag = String(datum.getDate()).padStart(2, '0');
  return `${ar}-${manad}-${dag}`;
}

function strangTillDatum(datum: string) {
  const [ar, manad, dag] = datum.split('-').map(Number);
  return new Date(ar, manad - 1, dag);
}

function formatVisaValtDatum(datum: string) {
  const date = strangTillDatum(datum);

  const veckodagar = [
    'Söndag',
    'Måndag',
    'Tisdag',
    'Onsdag',
    'Torsdag',
    'Fredag',
    'Lördag',
  ];

  const manader = [
    'jan',
    'feb',
    'mar',
    'apr',
    'maj',
    'jun',
    'jul',
    'aug',
    'sep',
    'okt',
    'nov',
    'dec',
  ];

  return `${veckodagar[date.getDay()]} ${date.getDate()} ${manader[date.getMonth()]}`;
}

function formatAktivText(datum: string) {
  const idag = new Date();
  idag.setHours(0, 0, 0, 0);

  const uppgiftsDatum = strangTillDatum(datum);
  uppgiftsDatum.setHours(0, 0, 0, 0);

  const skillnadMs = uppgiftsDatum.getTime() - idag.getTime();
  const skillnadDagar = Math.round(skillnadMs / (1000 * 60 * 60 * 24));

  if (skillnadDagar < 0) {
    return '(Försenad)';
  }

  if (skillnadDagar === 0) {
    return '(Idag)';
  }

  if (skillnadDagar === 1) {
    return '(Imorgon)';
  }

  const veckodagar = [
    'Söndag',
    'Måndag',
    'Tisdag',
    'Onsdag',
    'Torsdag',
    'Fredag',
    'Lördag',
  ];

  return `(På ${veckodagar[uppgiftsDatum.getDay()]})`;
}

function formatKommandeText(datum: string) {
  const uppgiftsDatum = strangTillDatum(datum);

  const veckodagar = [
    'Söndag',
    'Måndag',
    'Tisdag',
    'Onsdag',
    'Torsdag',
    'Fredag',
    'Lördag',
  ];

  const manader = [
    'jan',
    'feb',
    'mar',
    'apr',
    'maj',
    'jun',
    'jul',
    'aug',
    'sep',
    'okt',
    'nov',
    'dec',
  ];

  return `(${veckodagar[uppgiftsDatum.getDay()]} ${uppgiftsDatum.getDate()} ${
    manader[uppgiftsDatum.getMonth()]
  })`;
}

function formatAvslutadText(datum?: string) {
  if (!datum) {
    return '(Klart)';
  }

  const avslutatDatum = strangTillDatum(datum);

  const veckodagar = [
    'Söndag',
    'Måndag',
    'Tisdag',
    'Onsdag',
    'Torsdag',
    'Fredag',
    'Lördag',
  ];

  const manader = [
    'jan',
    'feb',
    'mar',
    'apr',
    'maj',
    'jun',
    'jul',
    'aug',
    'sep',
    'okt',
    'nov',
    'dec',
  ];

  return `(Klart: ${veckodagar[avslutatDatum.getDay()]} ${avslutatDatum.getDate()} ${
    manader[avslutatDatum.getMonth()]
  })`;
}

function formatDetaljDatum(uppgift: Uppgift) {
  if (uppgift.status === 'avslutad') {
    return formatAvslutadText(uppgift.klartDatum);
  }

  if (arIdag(uppgift.datum)) {
    return formatAktivText(uppgift.datum);
  }

  return formatKommandeText(uppgift.datum);
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

function formatUpprepningKortTextFranRegel(regel: UpprepningsRegel) {
  return formatUpprepningTextFranRegel(regel).replace('Upprepas ', '');
}

function formatStartTid(uppgift: Uppgift) {
  if (!uppgift.harStartTid || !uppgift.startTid) {
    return 'Ingen starttid';
  }

  return uppgift.startTid;
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

function hamtaForstaVeckodagIManad(ar: number, manad: number, veckodag: number) {
  const forstaDatum = new Date(ar, manad, 1);

  while (forstaDatum.getDay() !== veckodag) {
    forstaDatum.setDate(forstaDatum.getDate() + 1);
  }

  return forstaDatum;
}

function hamtaSistaVeckodagIManad(ar: number, manad: number, veckodag: number) {
  const sistaDatum = new Date(ar, manad + 1, 0);

  while (sistaDatum.getDay() !== veckodag) {
    sistaDatum.setDate(sistaDatum.getDate() - 1);
  }

  return sistaDatum;
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

function taBortGamlaAvslutadeUppgifter(uppgifter: Uppgift[]) {
  const idag = new Date();
  idag.setHours(0, 0, 0, 0);

  return uppgifter.filter((uppgift) => {
    if (uppgift.status !== 'avslutad' || !uppgift.klartDatum) {
      return true;
    }

    const klartDatum = strangTillDatum(uppgift.klartDatum);
    klartDatum.setHours(0, 0, 0, 0);

    const skillnadMs = idag.getTime() - klartDatum.getTime();
    const skillnadDagar = Math.floor(skillnadMs / (1000 * 60 * 60 * 24));

    return skillnadDagar < 5;
  });
}

function taBortGamlaAktivaUppgifter(uppgifter: Uppgift[]) {
  const idag = new Date();
  idag.setHours(0, 0, 0, 0);

  return uppgifter.filter((uppgift) => {
    if (uppgift.status !== 'aktiv') {
      return true;
    }

    const uppgiftsDatum = strangTillDatum(uppgift.datum);
    uppgiftsDatum.setHours(0, 0, 0, 0);

    return uppgiftsDatum.getTime() >= idag.getTime();
  });
}

function arIdag(datumStrang: string) {
  const idag = new Date();
  idag.setHours(0, 0, 0, 0);

  const uppgiftsDatum = strangTillDatum(datumStrang);
  uppgiftsDatum.setHours(0, 0, 0, 0);

  return uppgiftsDatum.getTime() === idag.getTime();
}

function hamtaTaskCardStyle(uppgift: Uppgift) {
  if (uppgift.arViktig) {
    return [styles.taskCard, styles.importantTaskCard];
  }

  return styles.taskCard;
}

function skapaStartUppgifter(): Uppgift[] {
  const idag = new Date();

  return [
    {
      id: '1',
      titel: 'Diska',
      status: 'aktiv',
      datum: datumTillStrang(idag),
    },
    {
      id: '2',
      titel: 'Dammsuga',
      status: 'aktiv',
      datum: datumTillStrang(new Date(idag.getFullYear(), idag.getMonth(), idag.getDate() + 1)),
    },
    {
      id: '3',
      titel: 'Tvätta',
      status: 'aktiv',
      datum: datumTillStrang(new Date(idag.getFullYear(), idag.getMonth(), idag.getDate() + 6)),
    },
    {
      id: '4',
      titel: 'Handla',
      status: 'avslutad',
      datum: datumTillStrang(new Date(idag.getFullYear(), idag.getMonth(), idag.getDate() - 1)),
      klartDatum: datumTillStrang(idag),
    },
  ];
}

function SwipeFlyttaBakgrund() {
  return (
    <View style={styles.swipeCompleteBackground}>
      <Text style={styles.swipeCompleteText}>Imorgon</Text>
    </View>
  );
}

function UppgiftsSektion({
  uppgifter,
  onTryckUppgift,
  kanSwipeFlytta = false,
  onSwipeFlytta,
  swipeResetCounter = 0,
}: UppgiftsSektionProps) {
  return (
    <View style={styles.taskList}>
      {uppgifter.length === 0 ? (
        <Text style={styles.emptyText}>Inga uppgifter</Text>
      ) : (
        uppgifter.map((uppgift) => {
          let visningstext = '';

          if (uppgift.status === 'avslutad') {
            visningstext = formatAvslutadText(uppgift.klartDatum);
          } else if (arIdag(uppgift.datum)) {
            visningstext = formatAktivText(uppgift.datum);
          } else {
            visningstext = formatKommandeText(uppgift.datum);
          }

          const taskKort = (
            <Pressable
              onPress={() => onTryckUppgift?.(uppgift.id)}
              style={hamtaTaskCardStyle(uppgift)}
            >
              <View style={styles.taskHeaderRow}>
                <Text style={styles.taskTitle}>
                  {uppgift.status === 'avslutad' ? '✔ ' : ''}
                  {uppgift.titel}
                  {uppgift.kommentar ? ' [K]' : ''}
                </Text>

                <View style={styles.taskRightColumn}>
                  <Text style={styles.taskDueText}>
                    {visningstext.replace(/[()]/g, '')}
                  </Text>

                  {uppgift.harStartTid && uppgift.startTid && (
                    <Text style={styles.taskTimeText}>{uppgift.startTid}</Text>
                  )}
                </View>
              </View>            
            </Pressable>
          );

          return kanSwipeFlytta && uppgift.status === 'aktiv' ? (
            <Swipeable
              key={`${uppgift.id}-${swipeResetCounter}`}
              renderLeftActions={SwipeFlyttaBakgrund}
              leftThreshold={120}
              overshootLeft={false}
              onSwipeableOpen={() => {
                onSwipeFlytta?.(uppgift);
              }}
            >
              {taskKort}
            </Swipeable>
          ) : (
            <View key={uppgift.id}>{taskKort}</View>
          );
        })
      )}
    </View>
  );
}

type FlikKnappProps = {
  titel: Flik;
  aktivFlik: Flik;
  onPress: (flik: Flik) => void;
};

function FlikKnapp({ titel, aktivFlik, onPress }: FlikKnappProps) {
  const arAktiv = titel === aktivFlik;

  return (
    <Pressable
      style={[styles.tabButton, arAktiv && styles.tabButtonActive]}
      onPress={() => onPress(titel)}
    >
      <Text style={[styles.tabButtonText, arAktiv && styles.tabButtonTextActive]}>
        {titel}
      </Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const [aktivFlik, setAktivFlik] = useState<Flik>('Idag');
  const [visaLaggTillModal, setVisaLaggTillModal] = useState(false);
  const [visaDatumValkare, setVisaDatumValkare] = useState(false);
  const [valdUppgift, setValdUppgift] = useState<Uppgift | null>(null);
  const [nyTitel, setNyTitel] = useState('');
  const [nyKommentar, setNyKommentar] = useState('');
  const [valtDatum, setValtDatum] = useState<Date>(new Date());
  const [uppgiftSomRedigeras, setUppgiftSomRedigeras] = useState<Uppgift | null>(null);
  const [arViktig, setArViktig] = useState(false);
  
  const [visaViktigBekraftelse, setVisaViktigBekraftelse] = useState(false);
  const [uppgiftAttFlytta, setUppgiftAttFlytta] = useState<Uppgift | null>(null);
  const [swipeResetCounter, setSwipeResetCounter] = useState(0);

  const [harStartTid, setHarStartTid] = useState(false);
  const [startTimme, setStartTimme] = useState('08');
  const [startMinut, setStartMinut] = useState('00');
  const [visaStartTidValkare, setVisaStartTidValkare] = useState(false);

  const [visaUpprepningModal, setVisaUpprepningModal] = useState(false);
  const [upprepningTyp, setUpprepningTyp] = useState<'ingen' | 'daglig' | 'veckovis' | 'manadsvis'>('ingen');
  const [upprepningarLista, setUpprepningarLista] = useState<UpprepningsRegel[]>([]);
  const [upprepningDagar, setUpprepningDagar] = useState('1');
  const [upprepningVeckoFrekvens, setUpprepningVeckoFrekvens] = useState('Varje');
  const [upprepningVeckodag, setUpprepningVeckodag] = useState('Måndag');
  const [upprepningManadsFrekvens, setUpprepningManadsFrekvens] = useState('Varje');
  const [upprepningManadsDag, setUpprepningManadsDag] = useState('1');
  const [upprepningManadsDynamisk, setUpprepningManadsDynamisk] = useState(false);
  const [upprepningManadsPosition, setUpprepningManadsPosition] = useState('Första');
  const [upprepningManadsDynamiskVeckodag, setUpprepningManadsDynamiskVeckodag] = useState('Måndag');
  const [upprepningManadsDynamiskFrekvens, setUpprepningManadsDynamiskFrekvens] = useState('Varje');
  
  const [uppgifter, setUppgifter] = useState<Uppgift[]>([]);
  const [harLaddat, setHarLaddat] = useState(false);

  useEffect(() => {
    async function laddaUppgifter() {
      try {
        const sparadeUppgifter = await AsyncStorage.getItem(STORAGE_KEY);

        if (sparadeUppgifter) {
          const laddadeUppgifter: Uppgift[] = JSON.parse(sparadeUppgifter);
          const rensadeUppgifter = taBortGamlaAktivaUppgifter(
            taBortGamlaAvslutadeUppgifter(laddadeUppgifter)
          );
          setUppgifter(rensadeUppgifter);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rensadeUppgifter));
        } else {
          const startUppgifter = taBortGamlaAktivaUppgifter(
            taBortGamlaAvslutadeUppgifter(skapaStartUppgifter())
          );
          setUppgifter(startUppgifter);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(startUppgifter));
        }
      } catch (error) {
        console.log('Kunde inte ladda uppgifter:', error);
        setUppgifter(skapaStartUppgifter());
      } finally {
        setHarLaddat(true);
      }
    }

    laddaUppgifter();
  }, []);

  useEffect(() => {
    async function sparaUppgifter() {
      try {
        const rensadeUppgifter = taBortGamlaAvslutadeUppgifter(uppgifter);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rensadeUppgifter));
      } catch (error) {
        console.log('Kunde inte spara uppgifter:', error);
      }
    }

    if (harLaddat) {
      sparaUppgifter();
    }
  }, [uppgifter, harLaddat]);

  useEffect(() => {
    if (!harLaddat) {
      return;
    }

    const rensadeUppgifter = taBortGamlaAvslutadeUppgifter(uppgifter);

    if (rensadeUppgifter.length !== uppgifter.length) {
      setUppgifter(rensadeUppgifter);
    }
  }, [uppgifter, harLaddat]);

  function oppnaLaggTillModal() {
    setUppgiftSomRedigeras(null);
    setNyTitel('');
    setNyKommentar('');
    setValtDatum(new Date());
    setVisaDatumValkare(false);
    setArViktig(false);

    setHarStartTid(false);
    setStartTimme('08');
    setStartMinut('00');
    setVisaStartTidValkare(false);
    
    setVisaUpprepningModal(false);
    setUpprepningTyp('ingen');
    setUpprepningarLista([]);
    setUpprepningDagar('1');
    setUpprepningVeckoFrekvens('Varje');
    setUpprepningVeckodag('Måndag');
    setUpprepningManadsFrekvens('Varje');
    setUpprepningManadsDag('1');
    setUpprepningManadsDynamisk(false);
    setUpprepningManadsPosition('Första');
    setUpprepningManadsDynamiskVeckodag('Måndag');
    setUpprepningManadsDynamiskFrekvens('Varje');
    
    setVisaLaggTillModal(true);
  }

  function stangLaggTillModal() {
    setVisaLaggTillModal(false);
    setNyTitel('');
    setNyKommentar('');
    setValtDatum(new Date());
    setVisaDatumValkare(false);
    setUppgiftSomRedigeras(null);
    setVisaStartTidValkare(false);
    setArViktig(false);
  }

  function oppnaRedigeraModal() {
    if (!valdUppgift) {
      return;
    }

    setUppgiftSomRedigeras(valdUppgift);

    setNyTitel(valdUppgift.titel);
    setNyKommentar(valdUppgift.kommentar ?? '');
    setValtDatum(strangTillDatum(valdUppgift.datum));
    setArViktig(valdUppgift.arViktig ?? false);

    setVisaStartTidValkare(false);
    setHarStartTid(valdUppgift.harStartTid ?? false);

    if (valdUppgift.harStartTid && valdUppgift.startTid) {
      const delar = valdUppgift.startTid.split(':');
      setStartTimme(delar[0] ?? '08');
      setStartMinut(delar[1] ?? '00');
    } else {
      setStartTimme('08');
      setStartMinut('00');
    }

    setUpprepningarLista(valdUppgift.upprepningar ?? []);

    setUpprepningTyp('ingen');
    setUpprepningDagar('1');

    setUpprepningVeckoFrekvens('Varje');
    setUpprepningVeckodag('Måndag');

    setUpprepningManadsFrekvens('Varje');
    setUpprepningManadsDag('1');

    setUpprepningManadsDynamisk(false);
    setUpprepningManadsPosition('Första');
    setUpprepningManadsDynamiskVeckodag('Måndag');
    setUpprepningManadsDynamiskFrekvens('Varje');

    setValdUppgift(null);
    setVisaDatumValkare(false);
    setVisaUpprepningModal(false);
    setVisaLaggTillModal(true);
  }

  function oppnaUpprepningModal() {
    setVisaLaggTillModal(false);
    setVisaDatumValkare(false);
    setVisaStartTidValkare(false);
    setVisaUpprepningModal(true);
  }

  function stangUpprepningModal() {
    setVisaUpprepningModal(false);
    setVisaLaggTillModal(true);
  }

  function sparaUpprepningsRegel() {
    if (upprepningTyp === 'ingen') {
      setVisaUpprepningModal(false);
      setVisaLaggTillModal(true);
      return;
    }

    let nyRegel: UpprepningsRegel;

    if (upprepningTyp === 'daglig') {
      nyRegel = {
        typ: 'daglig',
        dagar: Number(upprepningDagar) || 1,
      };
    } else if (upprepningTyp === 'veckovis') {
      nyRegel = {
        typ: 'veckovis',
        veckoFrekvens: upprepningVeckoFrekvens,
        veckodag: upprepningVeckodag,
      };
    } else {
      nyRegel = {
        typ: 'manadsvis',
        manadsDynamisk: upprepningManadsDynamisk,
        manadsFrekvens: !upprepningManadsDynamisk ? upprepningManadsFrekvens : undefined,
        manadsDag: !upprepningManadsDynamisk ? Number(upprepningManadsDag) || 1 : undefined,
        manadsPosition: upprepningManadsDynamisk ? upprepningManadsPosition : undefined,
        manadsDynamiskVeckodag: upprepningManadsDynamisk
          ? upprepningManadsDynamiskVeckodag
          : undefined,
        manadsDynamiskFrekvens: upprepningManadsDynamisk
          ? upprepningManadsDynamiskFrekvens
          : undefined,
      };
    }

    setUpprepningarLista((nuvarande) => [...nuvarande, nyRegel]);

    setUpprepningTyp('ingen');
    setUpprepningDagar('1');
    setUpprepningVeckoFrekvens('Varje');
    setUpprepningVeckodag('Måndag');
    setUpprepningManadsFrekvens('Varje');
    setUpprepningManadsDag('1');
    setUpprepningManadsDynamisk(false);
    setUpprepningManadsPosition('Första');
    setUpprepningManadsDynamiskVeckodag('Måndag');
    setUpprepningManadsDynamiskFrekvens('Varje');

    setVisaUpprepningModal(false);
    setVisaLaggTillModal(true);
  }

  function hanteraDatumAndring(event: any, valt?: Date) {
    if (event.type === 'dismissed') {
      setVisaDatumValkare(false);
      return;
    }

    if (valt) {
      setValtDatum(valt);
      setVisaDatumValkare(false);
    }
  }

  function hanteraLaggTillUppgift() {
    const renTitel = nyTitel.trim();

    if (!renTitel) {
      return;
    }

    const datumStrang = datumTillStrang(valtDatum);

    const sparadUppgift: Uppgift = {
      id: uppgiftSomRedigeras ? uppgiftSomRedigeras.id : Date.now().toString(),
      titel: renTitel,
      status: uppgiftSomRedigeras ? uppgiftSomRedigeras.status : 'aktiv',
      datum: datumStrang,
      kommentar: nyKommentar.trim() || undefined,
      arViktig,
      harStartTid,
      startTid: harStartTid ? `${startTimme}:${startMinut}` : undefined,
      upprepningar: upprepningarLista,
      klartDatum: uppgiftSomRedigeras?.klartDatum,
    };

    if (uppgiftSomRedigeras) {
      setUppgifter((nuvarandeUppgifter) =>
        nuvarandeUppgifter.map((uppgift) =>
          uppgift.id === uppgiftSomRedigeras.id ? sparadUppgift : uppgift
        )
      );
    } else {
      setUppgifter((nuvarandeUppgifter) => [sparadUppgift, ...nuvarandeUppgifter]);
    }

    setUppgiftSomRedigeras(null);
    setAktivFlik(arIdag(datumStrang) ? 'Idag' : 'Framtida');
    stangLaggTillModal();
  }

  function oppnaUppgift(id: string) {
    const hittadUppgift = uppgifter.find((uppgift) => uppgift.id === id) ?? null;
    setValdUppgift(hittadUppgift);
  }
  
  function stangUppgift() {
    setValdUppgift(null);
  }

  function flyttaUppgiftTillImorgon(uppgift: Uppgift) {
    if (uppgift.arViktig) {
      setUppgiftAttFlytta(uppgift);
      setVisaViktigBekraftelse(true);
      return;
    }

    const nuvarandeDatum = strangTillDatum(uppgift.datum);
    const imorgon = new Date(nuvarandeDatum);
    imorgon.setDate(imorgon.getDate() + 1);

    const nyttDatum = datumTillStrang(imorgon);

    setUppgifter((nuvarandeUppgifter) =>
      nuvarandeUppgifter.map((nuvarandeUppgift) =>
        nuvarandeUppgift.id === uppgift.id
          ? {
              ...nuvarandeUppgift,
              datum: nyttDatum,
            }
          : nuvarandeUppgift
      )
    );
  }

  function bekraftaFlyttaTillImorgon() {
    if (!uppgiftAttFlytta) {
      return;
    }

    const nuvarandeDatum = strangTillDatum(uppgiftAttFlytta.datum);
    const imorgon = new Date(nuvarandeDatum);
    imorgon.setDate(imorgon.getDate() + 1);

    const nyttDatum = datumTillStrang(imorgon);

    setUppgifter((nuvarandeUppgifter) =>
      nuvarandeUppgifter.map((uppgift) =>
        uppgift.id === uppgiftAttFlytta.id
          ? {
              ...uppgift,
              datum: nyttDatum,
            }
          : uppgift
      )
    );

    setUppgiftAttFlytta(null);
    setVisaViktigBekraftelse(false);
    setSwipeResetCounter((nuvarande) => nuvarande + 1);
  }

  function avbrytFlyttaTillImorgon() {
    setUppgiftAttFlytta(null);
    setVisaViktigBekraftelse(false);
    setSwipeResetCounter((nuvarande) => nuvarande + 1);
  }

  function markeraUppgiftSomKlar(uppgiftAttSlutfora: Uppgift) {
    const avslutadIdag = datumTillStrang(new Date());

    const uppdateradUppgift: Uppgift = {
      ...uppgiftAttSlutfora,
      status: 'avslutad',
      klartDatum: avslutadIdag,
    };

    let nyaUppgifter: Uppgift[] = [];

    if (uppgiftAttSlutfora.upprepningar && uppgiftAttSlutfora.upprepningar.length > 0) {
      nyaUppgifter = uppgiftAttSlutfora.upprepningar.map((regel, index) => ({
        ...uppgiftAttSlutfora,
        id: `${Date.now()}-${index}`,
        status: 'aktiv',
        datum: beraknaNastaDatumFranRegel(uppgiftAttSlutfora.datum, regel),
        klartDatum: undefined,
        upprepningar: [regel],
      }));
    }

    setUppgifter((nuvarandeUppgifter) => {
      const uppdaterade = nuvarandeUppgifter.map((uppgift) =>
        uppgift.id === uppgiftAttSlutfora.id ? uppdateradUppgift : uppgift
      );

      if (nyaUppgifter.length > 0) {
        return [...nyaUppgifter, ...uppdaterade];
      }

      return uppdaterade;
    });

  }

  function hanteraKlarFranDetalj() {
    if (!valdUppgift) {
      return;
    }

    markeraUppgiftSomKlar(valdUppgift);
    stangUppgift();
  }

  function hanteraTaBortFranDetalj() {
    if (!valdUppgift) {
      return;
    }

    setUppgifter((nuvarandeUppgifter) =>
      nuvarandeUppgifter.filter((uppgift) => uppgift.id !== valdUppgift.id)
    );

    stangUppgift();
  }


  const idagUppgifter = uppgifter
    .filter((uppgift) => uppgift.status === 'aktiv' && arIdag(uppgift.datum))
    .sort((a, b) => strangTillDatum(a.datum).getTime() - strangTillDatum(b.datum).getTime()
  );

  const framtidaUppgifter = uppgifter
    .filter((uppgift) => {
      if (uppgift.status !== 'aktiv') {
        return false;
      }

      const idag = new Date();
      idag.setHours(0, 0, 0, 0);

      const uppgiftsDatum = strangTillDatum(uppgift.datum);
      uppgiftsDatum.setHours(0, 0, 0, 0);

      return uppgiftsDatum.getTime() > idag.getTime();
    })
    .sort((a, b) => strangTillDatum(a.datum).getTime() - strangTillDatum(b.datum).getTime()
  );


  let innehall = null;

  if (aktivFlik === 'Idag') {
    innehall = (
      <UppgiftsSektion
        uppgifter={idagUppgifter}
        onTryckUppgift={oppnaUppgift}
        kanSwipeFlytta={true}
        onSwipeFlytta={flyttaUppgiftTillImorgon}
        swipeResetCounter={swipeResetCounter}
      />
    );
  } else {
    innehall = (
      <UppgiftsSektion
        uppgifter={framtidaUppgifter}
        onTryckUppgift={oppnaUppgift}
      />
    );
  }

  return (
   <GestureHandlerRootView style={{ flex: 1 }}>
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <Pressable style={styles.addButton} onPress={oppnaLaggTillModal}>
          <Text style={styles.addButtonText}>Lägg till ny</Text>
        </Pressable>

        <View style={styles.tabRow}>
          <FlikKnapp titel="Idag" aktivFlik={aktivFlik} onPress={setAktivFlik} />
          <FlikKnapp titel="Framtida" aktivFlik={aktivFlik} onPress={setAktivFlik} />
        </View>

        <ScrollView
          style={styles.contentScroll}
          contentContainerStyle={styles.contentScrollInner}
          keyboardShouldPersistTaps="handled"
        >
          {innehall}
        </ScrollView>

        
        <Modal
          visible={visaLaggTillModal}
          animationType="slide"
          transparent={true}
          onRequestClose={stangLaggTillModal}
        >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              >
              <Text style={styles.modalTitle}>
                {uppgiftSomRedigeras ? 'Redigera uppgift' : 'Lägg till ny'}
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Skriv titel..."
                placeholderTextColor="#777"
                value={nyTitel}
                onChangeText={setNyTitel}
                autoFocus
              />

              

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Kommentar..."
                placeholderTextColor="#777"
                value={nyKommentar}
                onChangeText={setNyKommentar}
                multiline
                textAlignVertical="top"
              />

              

              <Text style={styles.fieldLabel}>Datum</Text>

                <Pressable
                  style={styles.dateButton}
                  onPress={() => {
                    setVisaStartTidValkare(false);
                    setVisaDatumValkare(true);
                  }}
                >
                  <Text style={styles.dateButtonText}>
                    {formatVisaValtDatum(datumTillStrang(valtDatum))}
                  </Text>
                </Pressable>

              {visaDatumValkare && (
                <View style={styles.datePickerWrapper}>
                  <DateTimePicker
                    value={valtDatum}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    themeVariant="light"
                    accentColor="#1f6feb"
                    onChange={hanteraDatumAndring}
                  />
                </View>
              )}

              <Text style={styles.fieldLabel}>Starttid</Text>

                <View style={styles.startTimeRow}>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => setVisaStartTidValkare((nuvarande) => !nuvarande)}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {harStartTid ? `${startTimme}:${startMinut}` : 'Ingen starttid'}
                    </Text>
                  </Pressable>

                  {harStartTid && (
                    <Pressable
                      style={styles.smallCloseButton}
                      onPress={() => {
                        setHarStartTid(false);
                        setStartTimme('08');
                        setStartMinut('00');
                        setVisaStartTidValkare(false);
                      }}
                    >
                      <Text style={styles.smallCloseButtonText}>{'\u00D7'}</Text>
                    </Pressable>
                  )}
                </View>

                {visaStartTidValkare && (
                  <View style={styles.doublePickerBox}>
                    <View style={[styles.doublePickerColumn, styles.doublePickerDivider]}>
                      <Picker
                        style={styles.picker}
                        itemStyle={styles.pickerItem}
                        selectedValue={startTimme}
                        onValueChange={(value) => {
                          setHarStartTid(true);
                          setStartTimme(value);
                        }}
                      >
                        <Picker.Item label="00" value="00" />
                        <Picker.Item label="01" value="01" />
                        <Picker.Item label="02" value="02" />
                        <Picker.Item label="03" value="03" />
                        <Picker.Item label="04" value="04" />
                        <Picker.Item label="05" value="05" />
                        <Picker.Item label="06" value="06" />
                        <Picker.Item label="07" value="07" />
                        <Picker.Item label="08" value="08" />
                        <Picker.Item label="09" value="09" />
                        <Picker.Item label="10" value="10" />
                        <Picker.Item label="11" value="11" />
                        <Picker.Item label="12" value="12" />
                        <Picker.Item label="13" value="13" />
                        <Picker.Item label="14" value="14" />
                        <Picker.Item label="15" value="15" />
                        <Picker.Item label="16" value="16" />
                        <Picker.Item label="17" value="17" />
                        <Picker.Item label="18" value="18" />
                        <Picker.Item label="19" value="19" />
                        <Picker.Item label="20" value="20" />
                        <Picker.Item label="21" value="21" />
                        <Picker.Item label="22" value="22" />
                        <Picker.Item label="23" value="23" />
                      </Picker>
                    </View>

                    <View style={styles.doublePickerColumn}>
                      <Picker
                        style={styles.picker}
                        itemStyle={styles.pickerItem}
                        selectedValue={startMinut}
                        onValueChange={(value) => {
                          setHarStartTid(true);
                          setStartMinut(value);
                        }}
                      >
                        <Picker.Item label="00" value="00" />
                        <Picker.Item label="05" value="05" />
                        <Picker.Item label="10" value="10" />
                        <Picker.Item label="15" value="15" />
                        <Picker.Item label="20" value="20" />
                        <Picker.Item label="25" value="25" />
                        <Picker.Item label="30" value="30" />
                        <Picker.Item label="35" value="35" />
                        <Picker.Item label="40" value="40" />
                        <Picker.Item label="45" value="45" />
                        <Picker.Item label="50" value="50" />
                        <Picker.Item label="55" value="55" />
                      </Picker>
                    </View>
                  </View>
                )}

              <Text style={styles.fieldLabel}>Upprepning</Text>

                {upprepningarLista.length > 0 && (
                  <View style={styles.recurrenceListBox}>
                    {upprepningarLista.map((regel, index) => (
                      <View key={index} style={styles.recurrenceSummaryRow}>
                        <Text style={styles.recurrenceSummaryText}>
                          {formatUpprepningTextFranRegel(regel)}
                        </Text>

                        <Pressable
                          style={styles.smallCloseButton}
                          onPress={() =>
                            setUpprepningarLista((nuvarande) =>
                              nuvarande.filter((_, i) => i !== index)
                            )
                          }
                        >
                          <Text style={styles.smallCloseButtonText}>{'\u00D7'}</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                <Pressable
                  style={styles.secondaryButton}
                  onPress={oppnaUpprepningModal}
                >
                  <Text style={styles.secondaryButtonText}>Lägg till upprepning</Text>
                </Pressable>

              <View style={[styles.importantRow, styles.importantSectionSpacing]}>
                <Text style={styles.fieldLabel}>Markera som viktig</Text>

                <Pressable
                  style={[
                    styles.switchTrack,
                    arViktig && styles.switchTrackActive,
                  ]}
                  onPress={() => setArViktig((nuvarande) => !nuvarande)}
                >
                  <View
                    style={[
                      styles.switchThumb,
                      arViktig && styles.switchThumbActive,
                    ]}
                  />
                  <Text
                    style={[
                      styles.switchLabelLeft,
                      arViktig && styles.switchLabelHidden,
                    ]}
                  >
                    Nej
                  </Text>
                  <Text
                    style={[
                      styles.switchLabelRight,
                      !arViktig && styles.switchLabelHidden,
                    ]}
                  >
                    Ja
                  </Text>
                </Pressable>
              </View> 

              <View style={styles.modalButtonRow}>
                <Pressable style={styles.cancelButton} 
                  onPress={stangLaggTillModal}
                >
                  <Text style={styles.cancelButtonText}>Avbryt</Text>
                </Pressable>

                <Pressable style={styles.confirmButton} onPress={hanteraLaggTillUppgift}>
                  <Text style={styles.confirmButtonText}>Godkänn</Text>
                </Pressable>
              </View>
              </ScrollView>
            </View>
          </View>
        </TouchableWithoutFeedback>
        </Modal>
        
        <Modal
          visible={visaUpprepningModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setVisaUpprepningModal(false)}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <View style={[styles.modalHeaderRow, styles.recurrenceHeaderSpacing]}>
                  <Text style={styles.modalTitle}>Upprepning</Text>

                  <Pressable
                    style={styles.closeButton}
                    onPress={stangUpprepningModal}
                  >
                    <Text style={styles.closeButtonText}>{'\u00D7'}</Text>
                  </Pressable>
                </View>

                <View style={[styles.recurrenceTypeRow, styles.recurrenceTypeRowSpacing]}>
                  <Pressable
                    style={[
                      styles.recurrenceTypeButton,
                      upprepningTyp === 'daglig' && styles.recurrenceTypeButtonActive,
                    ]}
                    onPress={() => setUpprepningTyp('daglig')}
                  >
                    <Text
                      style={[
                        styles.recurrenceTypeButtonText,
                        upprepningTyp === 'daglig' && styles.recurrenceTypeButtonTextActive,
                      ]}
                    >
                      Dagsvis
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.recurrenceTypeButton,
                      upprepningTyp === 'veckovis' && styles.recurrenceTypeButtonActive,
                    ]}
                    onPress={() => {
                      setUpprepningTyp('veckovis');
                      setUpprepningManadsDynamisk(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.recurrenceTypeButtonText,
                        upprepningTyp === 'veckovis' && styles.recurrenceTypeButtonTextActive,
                      ]}
                    >
                      Veckovis
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.recurrenceTypeButton,
                      upprepningTyp === 'manadsvis' && styles.recurrenceTypeButtonActive,
                    ]}
                    onPress={() => setUpprepningTyp('manadsvis')}
                  >
                    <Text
                      style={[
                        styles.recurrenceTypeButtonText,
                        upprepningTyp === 'manadsvis' && styles.recurrenceTypeButtonTextActive,
                      ]}
                    >
                      Månadsvis
                    </Text>
                  </Pressable>
                </View>

                {upprepningTyp === 'daglig' && (
                  <View style={styles.detailInfoBox}>
                    <Text style={styles.detailInfoLabel}>Dagar mellan upprepningar</Text>
                    <TextInput
                      style={styles.input}
                      value={upprepningDagar}
                      onChangeText={setUpprepningDagar}
                      keyboardType="number-pad"
                      placeholder="1"
                      placeholderTextColor="#666"
                    />
                  </View>
                )}

                {upprepningTyp === 'veckovis' && (
                  <View style={styles.detailInfoBox}>
                    

                    <View style={styles.doublePickerBox}>
                      <View style={[styles.doublePickerColumn, styles.doublePickerDivider]}>
                        <Picker
                          style={styles.picker}
                          itemStyle={styles.pickerItem}
                          selectedValue={upprepningVeckoFrekvens}
                          onValueChange={(value) => setUpprepningVeckoFrekvens(value)}
                        >
                          <Picker.Item label="Varje" value="Varje" />
                          <Picker.Item label="Varannan" value="Varannan" />
                          <Picker.Item label="Var 3e" value="Var 3e" />
                          <Picker.Item label="Var 4e" value="Var 4e" />
                          <Picker.Item label="Var 5e" value="Var 5e" />
                          <Picker.Item label="Var 6e" value="Var 6e" />
                        </Picker>
                      </View>

                      <View style={styles.doublePickerColumn}>
                        <Picker
                          style={styles.picker}
                          itemStyle={styles.pickerItem}
                          selectedValue={upprepningVeckodag}
                          onValueChange={(value) => setUpprepningVeckodag(value)}
                        >
                          <Picker.Item label="Måndag" value="Måndag" />
                          <Picker.Item label="Tisdag" value="Tisdag" />
                          <Picker.Item label="Onsdag" value="Onsdag" />
                          <Picker.Item label="Torsdag" value="Torsdag" />
                          <Picker.Item label="Fredag" value="Fredag" />
                          <Picker.Item label="Lördag" value="Lördag" />
                          <Picker.Item label="Söndag" value="Söndag" />
                        </Picker>
                      </View>
                    </View>
                  </View>
                )}

                {upprepningTyp === 'manadsvis' && (
                  <View style={styles.detailInfoBox}>
                    <View style={styles.dynamicSectionBox}>
                      <View style={styles.dynamicRow}>
                        <Text style={styles.detailInfoLabel}>Dynamisk</Text>

                        <Pressable
                          style={[
                            styles.switchTrack,
                            upprepningManadsDynamisk && styles.switchTrackActive,
                          ]}
                          onPress={() =>
                            setUpprepningManadsDynamisk((nuvarande) => !nuvarande)
                          }
                        >
                          <View
                            style={[
                              styles.switchThumb,
                              upprepningManadsDynamisk && styles.switchThumbActive,
                            ]}
                          />
                          <Text
                            style={[
                              styles.switchLabelLeft,
                              upprepningManadsDynamisk && styles.switchLabelHidden,
                            ]}
                          >
                            Nej
                          </Text>
                          <Text
                            style={[
                              styles.switchLabelRight,
                              !upprepningManadsDynamisk && styles.switchLabelHidden,
                            ]}
                          >
                            Ja
                          </Text>
                        </Pressable>
                      </View>
                    </View>

                    {upprepningManadsDynamisk ? (
                      <>
                        <View style={styles.positionButtonRow}>
                          <Pressable
                            style={[
                              styles.positionButton,
                              upprepningManadsPosition === 'Första' && styles.positionButtonActive,
                            ]}
                            onPress={() => setUpprepningManadsPosition('Första')}
                          >
                            <Text
                              style={[
                                styles.positionButtonText,
                                upprepningManadsPosition === 'Första' && styles.positionButtonTextActive,
                              ]}
                            >
                              Första
                            </Text>
                          </Pressable>

                          <Pressable
                            style={[
                              styles.positionButton,
                              upprepningManadsPosition === 'Sista' && styles.positionButtonActive,
                            ]}
                            onPress={() => setUpprepningManadsPosition('Sista')}
                          >
                            <Text
                              style={[
                                styles.positionButtonText,
                                upprepningManadsPosition === 'Sista' && styles.positionButtonTextActive,
                              ]}
                            >
                              Sista
                            </Text>
                          </Pressable>
                        </View>

                        <View style={styles.pickerLabelRow}>
                          <Text style={styles.halfPickerLabel}>Veckodag</Text>
                          <Text style={styles.halfPickerLabel}>Hur ofta</Text>
                        </View>

                        <View style={styles.doublePickerBox}>
                          <View style={[styles.doublePickerColumn, styles.doublePickerDivider]}>
                            <Picker
                              style={styles.picker}
                              itemStyle={styles.pickerItem}
                              selectedValue={upprepningManadsDynamiskVeckodag}
                              onValueChange={(value) => setUpprepningManadsDynamiskVeckodag(value)}
                            >
                              <Picker.Item label="Måndag" value="Måndag" />
                              <Picker.Item label="Tisdag" value="Tisdag" />
                              <Picker.Item label="Onsdag" value="Onsdag" />
                              <Picker.Item label="Torsdag" value="Torsdag" />
                              <Picker.Item label="Fredag" value="Fredag" />
                              <Picker.Item label="Lördag" value="Lördag" />
                              <Picker.Item label="Söndag" value="Söndag" />
                            </Picker>
                          </View>

                          <View style={styles.doublePickerColumn}>
                            <Picker
                              style={styles.picker}
                              itemStyle={styles.pickerItem}
                              selectedValue={upprepningManadsDynamiskFrekvens}
                              onValueChange={(value) => setUpprepningManadsDynamiskFrekvens(value)}
                            >
                              <Picker.Item label="Varje" value="Varje" />
                              <Picker.Item label="Varannan" value="Varannan" />
                              <Picker.Item label="Var 3e" value="Var 3e" />
                              <Picker.Item label="Var 4e" value="Var 4e" />
                              <Picker.Item label="Var 5e" value="Var 5e" />
                              <Picker.Item label="Var 6e" value="Var 6e" />
                            </Picker>
                          </View>
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={styles.pickerLabelRow}>
                          <Text style={styles.halfPickerLabel}>Hur ofta</Text>
                          <Text style={styles.halfPickerLabel}>Dag i månaden</Text>
                        </View>

                        <View style={styles.doublePickerBox}>
                          <View style={[styles.doublePickerColumn, styles.doublePickerDivider]}>
                            <Picker
                              style={styles.picker}
                              itemStyle={styles.pickerItem}
                              selectedValue={upprepningManadsFrekvens}
                              onValueChange={(value) => setUpprepningManadsFrekvens(value)}
                            >
                              <Picker.Item label="Varje" value="Varje" />
                              <Picker.Item label="Varannan" value="Varannan" />
                              <Picker.Item label="Var 3e" value="Var 3e" />
                              <Picker.Item label="Var 4e" value="Var 4e" />
                              <Picker.Item label="Var 5e" value="Var 5e" />
                              <Picker.Item label="Var 6e" value="Var 6e" />
                            </Picker>
                          </View>

                          <View style={styles.doublePickerColumn}>
                            <Picker
                              style={styles.picker}
                              itemStyle={styles.pickerItem}
                              selectedValue={upprepningManadsDag}
                              onValueChange={(value) => setUpprepningManadsDag(value)}
                            >
                              <Picker.Item label="1" value="1" />
                              <Picker.Item label="2" value="2" />
                              <Picker.Item label="3" value="3" />
                              <Picker.Item label="4" value="4" />
                              <Picker.Item label="5" value="5" />
                              <Picker.Item label="6" value="6" />
                              <Picker.Item label="7" value="7" />
                              <Picker.Item label="8" value="8" />
                              <Picker.Item label="9" value="9" />
                              <Picker.Item label="10" value="10" />
                              <Picker.Item label="11" value="11" />
                              <Picker.Item label="12" value="12" />
                              <Picker.Item label="13" value="13" />
                              <Picker.Item label="14" value="14" />
                              <Picker.Item label="15" value="15" />
                              <Picker.Item label="16" value="16" />
                              <Picker.Item label="17" value="17" />
                              <Picker.Item label="18" value="18" />
                              <Picker.Item label="19" value="19" />
                              <Picker.Item label="20" value="20" />
                              <Picker.Item label="21" value="21" />
                              <Picker.Item label="22" value="22" />
                              <Picker.Item label="23" value="23" />
                              <Picker.Item label="24" value="24" />
                              <Picker.Item label="25" value="25" />
                              <Picker.Item label="26" value="26" />
                              <Picker.Item label="27" value="27" />
                              <Picker.Item label="28" value="28" />
                              <Picker.Item label="29" value="29" />
                              <Picker.Item label="30" value="30" />
                              <Picker.Item label="31" value="31" />
                            </Picker>
                          </View>
                        </View>
                      </>
                    )}
                  </View>
                )}

                {upprepningTyp !== 'ingen' && (
                  <Pressable
                    style={[styles.fullWidthConfirmButton, styles.recurrenceConfirmSpacing]}
                    onPress={sparaUpprepningsRegel}
                  >
                    <Text style={styles.fullWidthConfirmButtonText}>Klar</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        <TaskDetailModal
          uppgift={valdUppgift}
          visible={valdUppgift !== null}
          onClose={stangUppgift}
          onComplete={hanteraKlarFranDetalj}
          onEdit={oppnaRedigeraModal}
          onDelete={hanteraTaBortFranDetalj}
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

      </View>
    </TouchableWithoutFeedback>
   </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
    gap: 20,
    marginTop: 30,
  },
  contentScroll: {
    flex: 1,
  },
  contentScrollInner: {
    paddingBottom: 20,
  },
  addButton: {
    backgroundColor: '#1f6feb',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#e9ecef',
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#1f6feb',
  },
  tabButtonText: {
    color: '#222',
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  taskList: {
    gap: 12,
  },
  taskCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  taskTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    marginRight: 12,
  },
  taskHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  taskDueText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#444',
    textAlign: 'right',
  },
  taskRecurrenceText: {
    marginTop: 6,
    fontSize: 14,
    color: '#666',
  },
  taskRightColumn: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minHeight: 42,
  },
  taskTimeText: {
    marginTop: 4,
    fontSize: 20,
    color: '#666',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  importantTaskCard: {
    borderWidth: 2,
    borderColor: '#fab14a',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    marginRight: 12,
  },
  modalScrollContent: {
    gap: 16,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 100,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#111',
  },
  modalButtonRow: {
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
  modalButtonColumn: {
    gap: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e9ecef',
  },
  closeButtonText: {
    fontSize: 22,
    lineHeight: 22,
    color: '#222',
    fontWeight: '600',
  },
  completeButton: {
    backgroundColor: '#1f6feb',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  commentButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  detailTopDate: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '700',
    color: '#444',
  },
  detailTopTime: {
    marginTop: 4,
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  detailActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#e9ecef',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#222',
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 10,
    backgroundColor: '#e9ecef',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#222',
    fontWeight: '600',
  },
  recurrenceSummaryText: {
    flex: 1,
    fontSize: 14,
    color: '#555',
  },
  recurrenceSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -6,
    marginBottom: 8,
  },
  smallCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e9ecef',
    marginLeft: 12,
  },
  smallCloseButtonText: {
    fontSize: 18,
    lineHeight: 18,
    color: '#222',
    fontWeight: '600',
  },
  fullWidthConfirmButton: {
    backgroundColor: '#1f6feb',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  fullWidthConfirmButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  recurrenceTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  recurrenceTypeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#e9ecef',
    alignItems: 'center',
  },
  recurrenceTypeButtonActive: {
    backgroundColor: '#1f6feb',
  },
  recurrenceTypeButtonText: {
    color: '#222',
    fontWeight: '600',
  },
  recurrenceTypeButtonTextActive: {
    color: '#fff',
  },
  recurrenceListBox: {
    gap: 8,
    marginTop: -6,
    marginBottom: 8,
  },
  dynamicSectionBox: {
    backgroundColor: '#fffdfd',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  dynamicRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchTrack: {
    width: 74,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#d0d7de',
    justifyContent: 'center',
    position: 'relative',
  },
  switchTrackActive: {
    backgroundColor: '#bcd7ff',
  },
  switchThumb: {
    position: 'absolute',
    left: 3,
    top: 3,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
  },
  switchThumbActive: {
    left: 43,
    backgroundColor: '#1f6feb',
  },
  switchLabelLeft: {
    position: 'absolute',
    left: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#222',
  },
  switchLabelRight: {
    position: 'absolute',
    right: 12,
    fontSize: 12,
    fontWeight: '600',
    color: '#222',
  },
  switchLabelHidden: {
    opacity: 0.35,
  },
  importantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  positionButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  positionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#e9ecef',
    alignItems: 'center',
  },
  positionButtonActive: {
    backgroundColor: '#1f6feb',
  },
  positionButtonText: {
    color: '#222',
    fontWeight: '600',
  },
  positionButtonTextActive: {
    color: '#fff',
  },
  detailInfoBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  detailInfoLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  detailInfoValue: {
    fontSize: 15,
    color: '#222',
  },
  detailHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailHeaderDate: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  pickerBox: {
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
    minHeight: 180,
    justifyContent: 'center'
  },
  picker: {
    height: 180,
    color: '#111',
  },
  pickerItem: {
    height: 180,
    color: '#111',
    fontSize: 20,
  },
  doublePickerBox: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#d0d7de',
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
    minHeight: 180,
  },
  doublePickerColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  doublePickerDivider: {
    borderRightWidth: 1,
    borderRightColor: '#d0d7de',
  },
  pickerLabelRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  halfPickerLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  datePickerWrapper: {
    alignItems: 'center',
  },
  startTimeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -4,
    marginBottom: 8,
  },
  startTimeSummaryText: {
    flex: 1,
    fontSize: 14,
    color: '#555',
  },
  startTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  swipeCompleteBackground: {
    flex: 1,
    backgroundColor: '#d4edda',
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  swipeCompleteText: {
    color: '#155724',
    fontWeight: '700',
    fontSize: 16,
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

  /* Space between details */
  commentSectionSpacing: {
    marginTop: 20,
  },
  recurrenceSectionSpacing: {
    marginTop: 12,
  },
  detailButtonSpacing: {
    marginTop: 14,
  },
  recurrenceHeaderSpacing: {
    marginBottom: 20,
  },
  recurrenceTypeRowSpacing: {
    marginBottom: 12,
  },
  recurrenceConfirmSpacing: {
    marginTop: 14,
  },
  importantSectionSpacing: {
    marginTop: 8,
  },
});
