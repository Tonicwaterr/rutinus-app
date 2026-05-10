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

type Uppgift = {
  id: string;
  titel: string;
  status: 'aktiv' | 'avslutad';
  datum: string; // YYYY-MM-DD
  klartDatum?: string;
  kommentar?: string;

  upprepningTyp?: 'ingen' | 'daglig' | 'veckovis' | 'manadsvis';
  upprepningDagar?: number;
  upprepningVeckoFrekvens?: string;
  upprepningVeckodag?: string;
  upprepningManadsFrekvens?: string;
  upprepningManadsDag?: number;
  upprepningManadsDynamisk?: boolean;
  upprepningManadsPosition?: string;
  upprepningManadsDynamiskVeckodag?: string;
  upprepningManadsDynamiskFrekvens?: string;
};

type Flik = 'Aktiva' | 'Kommande' | 'Avslutade';

type UppgiftsSektionProps = {
  uppgifter: Uppgift[];
  onTryckUppgift?: (id: string) => void;
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

  if (arAktiv(uppgift.datum)) {
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

function formatUpprepningText(uppgift: Uppgift) {
  if (!uppgift.upprepningTyp || uppgift.upprepningTyp === 'ingen') {
    return 'Ingen upprepning';
  }

  if (uppgift.upprepningTyp === 'daglig') {
    const dagar = uppgift.upprepningDagar ?? 1;

    if (dagar === 1) {
      return 'Upprepas varje dag';
    }

    if (dagar === 2) {
      return 'Upprepas varannan dag';
    }

    return `Upprepas var ${dagar} dagar`;
  }

  if (uppgift.upprepningTyp === 'veckovis') {
    const frekvensText = formatVeckoFrekvensText(uppgift.upprepningVeckoFrekvens);
    const veckodag = uppgift.upprepningVeckodag?.toLowerCase() ?? '';

    return `Upprepas ${frekvensText} ${veckodag}`.trim();
  }

  if (uppgift.upprepningTyp === 'manadsvis') {
    if (uppgift.upprepningManadsDynamisk) {
      const position = uppgift.upprepningManadsPosition?.toLowerCase() ?? '';
      const veckodag = formatVeckodagBestamdForm(
        uppgift.upprepningManadsDynamiskVeckodag
      );
      const frekvensText = formatManadsFrekvensText(
        uppgift.upprepningManadsDynamiskFrekvens
      );

      return `Upprepas den ${position} ${veckodag} ${frekvensText}`.trim();
    }

    const dagText = formatManadsDagText(uppgift.upprepningManadsDag);
    const frekvensText = formatManadsFrekvensText(uppgift.upprepningManadsFrekvens);

    return `Upprepas den ${dagText} ${frekvensText}`.trim();
  }

  return 'Ingen upprepning';
}

function formatUpprepningKortText(uppgift: Uppgift) {
  if (!uppgift.upprepningTyp || uppgift.upprepningTyp === 'ingen') {
    return '';
  }

  return formatUpprepningText(uppgift).replace('Upprepas ', '');
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

function beraknaNastaDatum(uppgift: Uppgift) {
  const aktuelltDatum = strangTillDatum(uppgift.datum);

  if (uppgift.upprepningTyp === 'daglig') {
    const dagar = uppgift.upprepningDagar ?? 1;
    const nyttDatum = new Date(aktuelltDatum);
    nyttDatum.setDate(nyttDatum.getDate() + dagar);
    return datumTillStrang(nyttDatum);
  }

  if (uppgift.upprepningTyp === 'veckovis') {
    const stegVeckor = hamtaFrekvensNummer(uppgift.upprepningVeckoFrekvens);
    const malVeckodag = hamtaVeckodagNummer(uppgift.upprepningVeckodag);

    const nyttDatum = new Date(aktuelltDatum);
    nyttDatum.setDate(nyttDatum.getDate() + stegVeckor * 7);

    while (nyttDatum.getDay() !== malVeckodag) {
      nyttDatum.setDate(nyttDatum.getDate() + 1);
    }

    return datumTillStrang(nyttDatum);
  }

  if (uppgift.upprepningTyp === 'manadsvis') {
    if (uppgift.upprepningManadsDynamisk) {
      const stegManader = hamtaFrekvensNummer(
        uppgift.upprepningManadsDynamiskFrekvens
      );
      const malVeckodag = hamtaVeckodagNummer(
        uppgift.upprepningManadsDynamiskVeckodag
      );

      const nyttAr = aktuelltDatum.getFullYear();
      const nyManad = aktuelltDatum.getMonth() + stegManader;

      let nyttDatum: Date;

      if (uppgift.upprepningManadsPosition === 'Sista') {
        nyttDatum = hamtaSistaVeckodagIManad(nyttAr, nyManad, malVeckodag);
      } else {
        nyttDatum = hamtaForstaVeckodagIManad(nyttAr, nyManad, malVeckodag);
      }

      return datumTillStrang(nyttDatum);
    }

    const stegManader = hamtaFrekvensNummer(uppgift.upprepningManadsFrekvens);
    const manadsDag = uppgift.upprepningManadsDag ?? 1;

    const nyttAr = aktuelltDatum.getFullYear();
    const nyManad = aktuelltDatum.getMonth() + stegManader;

    const maxDag = new Date(nyttAr, nyManad + 1, 0).getDate();
    const giltigDag = Math.min(manadsDag, maxDag);

    const nyttDatum = new Date(nyttAr, nyManad, giltigDag);
    return datumTillStrang(nyttDatum);
  }

  return uppgift.datum;
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

function arAktiv(datum: string) {
  const idag = new Date();
  idag.setHours(0, 0, 0, 0);

  const uppgiftsDatum = strangTillDatum(datum);
  uppgiftsDatum.setHours(0, 0, 0, 0);

  const skillnadMs = uppgiftsDatum.getTime() - idag.getTime();
  const skillnadDagar = Math.round(skillnadMs / (1000 * 60 * 60 * 24));

  return skillnadDagar <= 3;
}

function hamtaTaskCardStyle(uppgift: Uppgift) {
  if (uppgift.status === 'avslutad') {
    return styles.taskCard;
  }

  const idag = new Date();
  idag.setHours(0, 0, 0, 0);

  const uppgiftsDatum = strangTillDatum(uppgift.datum);
  uppgiftsDatum.setHours(0, 0, 0, 0);

  const skillnadMs = uppgiftsDatum.getTime() - idag.getTime();
  const skillnadDagar = Math.round(skillnadMs / (1000 * 60 * 60 * 24));

  if (skillnadDagar < 0) {
    return [styles.taskCard, styles.taskCardLate];
  }

  if (skillnadDagar === 0) {
    return [styles.taskCard, styles.taskCardToday];
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

function UppgiftsSektion({
  uppgifter,
  onTryckUppgift,
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
          } else if (arAktiv(uppgift.datum)) {
            visningstext = formatAktivText(uppgift.datum);
          } else {
            visningstext = formatKommandeText(uppgift.datum);
          }

          return (
            <Pressable
              key={uppgift.id}
              onPress={() => onTryckUppgift?.(uppgift.id)}
              style={hamtaTaskCardStyle(uppgift)}
            >
              <View style={styles.taskHeaderRow}>
                <Text style={styles.taskTitle}>
                  {uppgift.status === 'avslutad' ? '✔ ' : ''}
                  {uppgift.titel}
                  {uppgift.kommentar ? ' [K]' : ''}
                </Text>

                <Text style={styles.taskDueText}>{visningstext.replace(/[()]/g, '')}</Text>
              </View>

              {uppgift.upprepningTyp && uppgift.upprepningTyp !== 'ingen' && (
                <Text style={styles.taskRecurrenceText}>
                  {formatUpprepningKortText(uppgift)}
                </Text>
              )}
            </Pressable>
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
  const [aktivFlik, setAktivFlik] = useState<Flik>('Aktiva');
  const [visaLaggTillModal, setVisaLaggTillModal] = useState(false);
  const [visaDatumValkare, setVisaDatumValkare] = useState(false);
  const [valdUppgift, setValdUppgift] = useState<Uppgift | null>(null);
  const [nyTitel, setNyTitel] = useState('');
  const [nyKommentar, setNyKommentar] = useState('');
  const [valtDatum, setValtDatum] = useState<Date>(new Date());
  const [uppgiftSomRedigeras, setUppgiftSomRedigeras] = useState<Uppgift | null>(null);

  const [visaUpprepningModal, setVisaUpprepningModal] = useState(false);
  const [upprepningTyp, setUpprepningTyp] = useState<'ingen' | 'daglig' | 'veckovis' | 'manadsvis'>('ingen');
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
          setUppgifter(taBortGamlaAvslutadeUppgifter(laddadeUppgifter));
        } else {
          setUppgifter(taBortGamlaAvslutadeUppgifter(skapaStartUppgifter()));
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
    
    setVisaUpprepningModal(false);
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
    
    setVisaLaggTillModal(true);
  }

  function stangLaggTillModal() {
    setVisaLaggTillModal(false);
    setNyTitel('');
    setNyKommentar('');
    setValtDatum(new Date());
    setVisaDatumValkare(false);
    setUppgiftSomRedigeras(null);
  }

  function oppnaRedigeraModal() {
    if (!valdUppgift) {
      return;
    }

    setUppgiftSomRedigeras(valdUppgift);

    setNyTitel(valdUppgift.titel);
    setNyKommentar(valdUppgift.kommentar ?? '');
    setValtDatum(strangTillDatum(valdUppgift.datum));

    setUpprepningTyp(valdUppgift.upprepningTyp ?? 'ingen');
    setUpprepningDagar(String(valdUppgift.upprepningDagar ?? 1));

    setUpprepningVeckoFrekvens(valdUppgift.upprepningVeckoFrekvens ?? 'Varje');
    setUpprepningVeckodag(valdUppgift.upprepningVeckodag ?? 'Måndag');

    setUpprepningManadsFrekvens(valdUppgift.upprepningManadsFrekvens ?? 'Varje');
    setUpprepningManadsDag(String(valdUppgift.upprepningManadsDag ?? 1));

    setUpprepningManadsDynamisk(valdUppgift.upprepningManadsDynamisk ?? false);
    setUpprepningManadsPosition(valdUppgift.upprepningManadsPosition ?? 'Första');
    setUpprepningManadsDynamiskVeckodag(
      valdUppgift.upprepningManadsDynamiskVeckodag ?? 'Måndag'
    );
    setUpprepningManadsDynamiskFrekvens(
      valdUppgift.upprepningManadsDynamiskFrekvens ?? 'Varje'
    );

    setValdUppgift(null);
    setVisaDatumValkare(false);
    setVisaUpprepningModal(false);
    setVisaLaggTillModal(true);
  }

  function oppnaUpprepningModal() {
    setVisaLaggTillModal(false);
    setVisaDatumValkare(false);
    setVisaUpprepningModal(true);
  }

  function stangUpprepningModal() {
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

      upprepningTyp,
      upprepningDagar:
        upprepningTyp === 'daglig' ? Number(upprepningDagar) || 1 : undefined,

      upprepningVeckoFrekvens:
        upprepningTyp === 'veckovis' ? upprepningVeckoFrekvens : undefined,
      upprepningVeckodag:
        upprepningTyp === 'veckovis' ? upprepningVeckodag : undefined,

      upprepningManadsFrekvens:
        upprepningTyp === 'manadsvis' && !upprepningManadsDynamisk
          ? upprepningManadsFrekvens
          : undefined,
      upprepningManadsDag:
        upprepningTyp === 'manadsvis' && !upprepningManadsDynamisk
          ? Number(upprepningManadsDag) || 1
          : undefined,

      upprepningManadsDynamisk:
        upprepningTyp === 'manadsvis' ? upprepningManadsDynamisk : undefined,
      upprepningManadsPosition:
        upprepningTyp === 'manadsvis' && upprepningManadsDynamisk
          ? upprepningManadsPosition
          : undefined,
      upprepningManadsDynamiskVeckodag:
        upprepningTyp === 'manadsvis' && upprepningManadsDynamisk
          ? upprepningManadsDynamiskVeckodag
          : undefined,
      upprepningManadsDynamiskFrekvens:
        upprepningTyp === 'manadsvis' && upprepningManadsDynamisk
          ? upprepningManadsDynamiskFrekvens
          : undefined,

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
    setAktivFlik(arAktiv(datumStrang) ? 'Aktiva' : 'Kommande');
    stangLaggTillModal();
  }

  function hanteraKlarUppgift(id: string) {
    setUppgifter((nuvarandeUppgifter) =>
      nuvarandeUppgifter.map((uppgift) =>
        uppgift.id === id
          ? {
              ...uppgift,
              status: 'avslutad',
              klartDatum: datumTillStrang(new Date()),
            }
          : uppgift
      )
    );
  }

  function oppnaUppgift(id: string) {
    const hittadUppgift = uppgifter.find((uppgift) => uppgift.id === id) ?? null;
    setValdUppgift(hittadUppgift);
  }
  
  function stangUppgift() {
    setValdUppgift(null);
  }

  function hanteraKlarFranDetalj() {
    if (!valdUppgift) {
      return;
    }

    const avslutadIdag = datumTillStrang(new Date());

    const uppdateradUppgift: Uppgift = {
      ...valdUppgift,
      status: 'avslutad',
      klartDatum: avslutadIdag,
    };

    let nyUppgift: Uppgift | null = null;

    if (valdUppgift.upprepningTyp && valdUppgift.upprepningTyp !== 'ingen') {
      nyUppgift = {
        ...valdUppgift,
        id: `${Date.now()}`,
        status: 'aktiv',
        datum: beraknaNastaDatum(valdUppgift),
        klartDatum: undefined,
      };
    }

    setUppgifter((nuvarandeUppgifter) => {
      const uppdaterade = nuvarandeUppgifter.map((uppgift) =>
        uppgift.id === valdUppgift.id ? uppdateradUppgift : uppgift
      );

      if (nyUppgift) {
        return [nyUppgift, ...uppdaterade];
      }

      return uppdaterade;
    });

    setAktivFlik('Avslutade');
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


  const aktivaUppgifter = uppgifter
    .filter((uppgift) => uppgift.status === 'aktiv' && arAktiv(uppgift.datum))
    .sort((a, b) => strangTillDatum(a.datum).getTime() - strangTillDatum(b.datum).getTime()
  );

  const kommandeUppgifter = uppgifter
    .filter((uppgift) => uppgift.status === 'aktiv' && !arAktiv(uppgift.datum))
    .sort((a, b) => strangTillDatum(a.datum).getTime() - strangTillDatum(b.datum).getTime()
  );

  const avslutadeUppgifter = uppgifter.filter(
    (uppgift) => uppgift.status === 'avslutad'
  );

  let innehall = null;

  if (aktivFlik === 'Aktiva') {
    innehall = (
      <UppgiftsSektion
        uppgifter={aktivaUppgifter}
        onTryckUppgift={oppnaUppgift}
      />
    );
  } else if (aktivFlik === 'Kommande') {
    innehall = (
      <UppgiftsSektion
        uppgifter={kommandeUppgifter}
        onTryckUppgift={oppnaUppgift}
      />
    );
  } else {
    innehall = (
      <UppgiftsSektion 
        uppgifter={avslutadeUppgifter}
        onTryckUppgift={oppnaUppgift} 
      />
    );
  }

  return (
   <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <View style={styles.container}>
      <Pressable style={styles.addButton} onPress={oppnaLaggTillModal}>
        <Text style={styles.addButtonText}>Lägg till ny</Text>
      </Pressable>

      <View style={styles.tabRow}>
        <FlikKnapp titel="Aktiva" aktivFlik={aktivFlik} onPress={setAktivFlik} />
        <FlikKnapp titel="Kommande" aktivFlik={aktivFlik} onPress={setAktivFlik} />
        <FlikKnapp titel="Avslutade" aktivFlik={aktivFlik} onPress={setAktivFlik} />
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

            <Text style={styles.fieldLabel}>Upprepning</Text>

              {upprepningTyp !== 'ingen' && (
                <View style={styles.recurrenceSummaryRow}>
                  <Text style={styles.recurrenceSummaryText}>
                    {formatUpprepningText({
                      id: '',
                      titel: '',
                      status: 'aktiv',
                      datum: datumTillStrang(valtDatum),
                      upprepningTyp,
                      upprepningDagar: upprepningTyp === 'daglig' ? Number(upprepningDagar) || 1 : undefined,
                      upprepningVeckoFrekvens:
                        upprepningTyp === 'veckovis' ? upprepningVeckoFrekvens : undefined,
                      upprepningVeckodag:
                        upprepningTyp === 'veckovis' ? upprepningVeckodag : undefined,
                      upprepningManadsFrekvens:
                        upprepningTyp === 'manadsvis' && !upprepningManadsDynamisk
                          ? upprepningManadsFrekvens
                          : undefined,
                      upprepningManadsDag:
                        upprepningTyp === 'manadsvis' && !upprepningManadsDynamisk
                          ? Number(upprepningManadsDag) || 1
                          : undefined,
                      upprepningManadsDynamisk:
                        upprepningTyp === 'manadsvis' ? upprepningManadsDynamisk : undefined,
                      upprepningManadsPosition:
                        upprepningTyp === 'manadsvis' && upprepningManadsDynamisk
                          ? upprepningManadsPosition
                          : undefined,
                      upprepningManadsDynamiskVeckodag:
                        upprepningTyp === 'manadsvis' && upprepningManadsDynamisk
                          ? upprepningManadsDynamiskVeckodag
                          : undefined,
                      upprepningManadsDynamiskFrekvens:
                        upprepningTyp === 'manadsvis' && upprepningManadsDynamisk
                          ? upprepningManadsDynamiskFrekvens
                          : undefined,
                    })}
                  </Text>

                  <Pressable
                    style={styles.smallCloseButton}
                    onPress={() => {
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
                    }}
                  >
                    <Text style={styles.smallCloseButtonText}>{'\u00D7'}</Text>
                  </Pressable>
                </View>
              )}

              <Pressable
                style={styles.secondaryButton}
                onPress={oppnaUpprepningModal}
              >
                <Text style={styles.secondaryButtonText}>Lägg till upprepning</Text>
              </Pressable> 

            <Text style={styles.fieldLabel}>Datum</Text>

              <Pressable
                style={styles.dateButton}
                onPress={() => setVisaDatumValkare(true)}
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
                  onPress={stangUpprepningModal}
                >
                  <Text style={styles.fullWidthConfirmButtonText}>Klar</Text>
                </Pressable>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={valdUppgift !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setValdUppgift(null)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              {valdUppgift && (
                <>
                  <View style={styles.detailHeaderRow}>
                    <Text style={styles.detailHeaderDate}>
                      {formatDetaljDatum(valdUppgift)}
                    </Text>

                    <Pressable style={styles.closeButton} onPress={stangUppgift}>
                      <Text style={styles.closeButtonText}>{'\u00D7'}</Text>
                    </Pressable>
                  </View>
                  
                  <Text style={styles.modalTitle}>{valdUppgift.titel}</Text>
                 
                  <View style={[styles.detailInfoBox, styles.commentSectionSpacing]}>
                    

                    <Text style={styles.detailInfoValue}>
                      {valdUppgift.kommentar ? valdUppgift.kommentar : 'Ingen kommentar'}
                    </Text>

                  </View>

                  <View style={[styles.detailInfoBox, styles.recurrenceSectionSpacing]}>
                    
                    <Text style={styles.detailInfoValue}>
                      {formatUpprepningText(valdUppgift)}
                    </Text>
                  </View>

                  <View style={[styles.modalButtonColumn, styles.detailButtonSpacing]}>
                    {valdUppgift.status !== 'avslutad' && (
                      <Pressable
                        style={styles.completeButton}
                        onPress={hanteraKlarFranDetalj}
                      >
                        <Text style={styles.completeButtonText}>Klar</Text>
                      </Pressable>
                    )}

                    <View style={styles.detailActionRow}>
                      <Pressable
                        style={styles.editButton}
                        onPress={oppnaRedigeraModal}
                      >
                        <Text style={styles.editButtonText}>Redigera</Text>
                      </Pressable>

                      <Pressable
                        style={styles.deleteButton}
                        onPress={hanteraTaBortFranDetalj}
                      >
                        <Text style={styles.deleteButtonText}>Ta bort</Text>
                      </Pressable>
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </View>
   </TouchableWithoutFeedback>
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
  taskCardToday: {
    backgroundColor: '#fff4cc',
  },
  taskCardLate: {
    backgroundColor: '#f8d7da',
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
  emptyText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
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
    fontSize: 20,
    fontWeight: '700',
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
});
