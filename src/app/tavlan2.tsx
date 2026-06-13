import React, { useRef, useState } from 'react';
import {
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';

type PlaceradLapp = {
  id: string;
  titel: string;
  farg: string;
  x: number;
  y: number;
};

type Matning = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const CARD_SIZE = 96;
const LAPPFARGER = ['#F6E27A', '#97D9FF', '#9BE58D', '#FFB7D5'];

const BOARD_COLOR = '#B8874C';
const FRAME_COLOR = '#6E4A2E';
const FRAME_COLOR_DARK = '#563821';
const FRAME_COLOR_LIGHT = '#8A5C3A';

function klamp(varde: number, min: number, max: number) {
  return Math.max(min, Math.min(varde, max));
}

function mataIWindow(ref: React.RefObject<View | null>): Promise<Matning | null> {
  return new Promise((resolve) => {
    if (!ref.current) {
      resolve(null);
      return;
    }

    ref.current.measureInWindow((x, y, width, height) => {
      resolve({ x, y, width, height });
    });
  });
}

export default function TavlanScreen() {
  const rootRef = useRef<View | null>(null);
  const stackRef = useRef<View | null>(null);
  const boardRef = useRef<View | null>(null);

  const rootMatningRef = useRef<Matning | null>(null);
  const boardMatningRef = useRef<Matning | null>(null);
  const dragOffsetRef = useRef({ x: CARD_SIZE / 2, y: CARD_SIZE / 2 });

  const [placeradeLappar, setPlaceradeLappar] = useState<PlaceradLapp[]>([]);
  const [nastaFargIndex, setNastaFargIndex] = useState(0);

  const [drarLapp, setDrarLapp] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });

  async function startaDrag(e: GestureResponderEvent) {
    const locationX = e.nativeEvent.locationX;
    const locationY = e.nativeEvent.locationY;

    const [rootMatning, stackMatning, boardMatning] = await Promise.all([
      mataIWindow(rootRef),
      mataIWindow(stackRef),
      mataIWindow(boardRef),
    ]);

    if (!rootMatning || !stackMatning || !boardMatning) {
      return;
    }

    rootMatningRef.current = rootMatning;
    boardMatningRef.current = boardMatning;

    dragOffsetRef.current = {
      x: locationX,
      y: locationY,
    };

    setDragPos({
      x: stackMatning.x - rootMatning.x,
      y: stackMatning.y - rootMatning.y,
    });
    setDrarLapp(true);
  }

  function avbrytDrag() {
    setDrarLapp(false);
  }

  async function slutförDrag(releaseX: number, releaseY: number) {
    const rootMatning = rootMatningRef.current;
    const boardMatning = boardMatningRef.current;

    if (!rootMatning || !boardMatning) {
      avbrytDrag();
      return;
    }

    const inomBoard =
      releaseX >= boardMatning.x &&
      releaseX <= boardMatning.x + boardMatning.width &&
      releaseY >= boardMatning.y &&
      releaseY <= boardMatning.y + boardMatning.height;

    if (!inomBoard) {
      avbrytDrag();
      return;
    }

    const relativX = releaseX - boardMatning.x - dragOffsetRef.current.x;
    const relativY = releaseY - boardMatning.y - dragOffsetRef.current.y;

    const slutligX = klamp(relativX, 12, boardMatning.width - CARD_SIZE - 12);
    const slutligY = Math.max(12, relativY);

    const nyLapp: PlaceradLapp = {
      id: `${Date.now()}`,
      titel: 'Ny lapp',
      farg: LAPPFARGER[nastaFargIndex],
      x: slutligX,
      y: slutligY,
    };

    setPlaceradeLappar((nuvarande) => [...nuvarande, nyLapp]);
    setNastaFargIndex((nuvarande) => (nuvarande + 1) % LAPPFARGER.length);
    setDrarLapp(false);
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !drarLapp,
      onMoveShouldSetPanResponder: () => !drarLapp,
      onPanResponderGrant: (e) => {
        startaDrag(e);
      },
      onPanResponderMove: (_, gestureState) => {
        const rootMatning = rootMatningRef.current;

        if (!rootMatning) {
          return;
        }

        setDragPos({
          x: gestureState.moveX - rootMatning.x - dragOffsetRef.current.x,
          y: gestureState.moveY - rootMatning.y - dragOffsetRef.current.y,
        });
      },
      onPanResponderRelease: (_, gestureState) => {
        slutförDrag(gestureState.moveX, gestureState.moveY);
      },
      onPanResponderTerminate: () => {
        avbrytDrag();
      },
    })
  ).current;

  const stackFarger = [
    LAPPFARGER[nastaFargIndex],
    LAPPFARGER[(nastaFargIndex + 1) % LAPPFARGER.length],
    LAPPFARGER[(nastaFargIndex + 2) % LAPPFARGER.length],
  ];

  const aktuellTopFarg = LAPPFARGER[nastaFargIndex];

  return (
    <View ref={rootRef} style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!drarLapp}
      >
        <View style={styles.boardFrame}>
          <View style={styles.boardTopArea}>
            <View style={styles.boardTopRow}>
              <View style={styles.stackDock}>
                <View ref={stackRef} style={styles.stackAnchor}>
                  <View
                    style={[
                      styles.stackLayer,
                      { backgroundColor: stackFarger[2], top: 12, left: 12 },
                    ]}
                  />
                  <View
                    style={[
                      styles.stackLayer,
                      { backgroundColor: stackFarger[1], top: 6, left: 6 },
                    ]}
                  />

                  <View
                    style={[
                      styles.stackLayer,
                      styles.stackTopCard,
                      {
                        backgroundColor: aktuellTopFarg,
                        opacity: drarLapp ? 0.35 : 1,
                      },
                    ]}
                    {...panResponder.panHandlers}
                  >
                    <Text style={styles.stackCardTitle} numberOfLines={2}>
                      Ny lapp
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.boardTopTextArea}>
                <Text style={styles.boardTitle}>Tavlan</Text>
                <Text style={styles.boardSubtitle}>
                  Dra en lapp från stapeln och släpp den på tavlan.
                </Text>
              </View>
            </View>
          </View>

          <View ref={boardRef} style={styles.boardSurface}>
            <View style={styles.boardCanvas}>
              {placeradeLappar.map((lapp) => (
                <View
                  key={lapp.id}
                  style={[
                    styles.placeradLapp,
                    {
                      backgroundColor: lapp.farg,
                      left: lapp.x,
                      top: lapp.y,
                    },
                  ]}
                >
                  <Text style={styles.placeradLappTitel} numberOfLines={2}>
                    {lapp.titel}
                  </Text>
                </View>
              ))}

              <View style={styles.boardExpansionSpace} />
            </View>
          </View>
        </View>
      </ScrollView>

      {drarLapp && (
        <View
          pointerEvents="none"
          style={[
            styles.dragOverlayCard,
            {
              backgroundColor: aktuellTopFarg,
              left: dragPos.x,
              top: dragPos.y,
            },
          ]}
        >
          <Text style={styles.placeradLappTitel} numberOfLines={2}>
            Ny lapp
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3efe8',
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 110,
  },

  boardFrame: {
    marginTop: 0,
    marginBottom: 20,
    borderRadius: 22,
    backgroundColor: FRAME_COLOR,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  boardTopArea: {
    paddingTop: 50,
    paddingHorizontal: 18,
    paddingBottom: 18,
    backgroundColor: FRAME_COLOR_LIGHT,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },

  boardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  stackDock: {
    width: 128,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginRight: 14,
  },

  stackAnchor: {
    width: CARD_SIZE + 14,
    height: CARD_SIZE + 14,
    position: 'relative',
  },

  stackLayer: {
    position: 'absolute',
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },

  stackTopCard: {
    top: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },

  stackCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3b2d1f',
    textAlign: 'center',
  },

  boardTopTextArea: {
    flex: 1,
    justifyContent: 'center',
  },

  boardTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fffaf2',
  },

  boardSubtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    color: '#f7ead9',
  },

  boardSurface: {
    minHeight: 620,
    backgroundColor: BOARD_COLOR,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },

  boardCanvas: {
    minHeight: 900,
    position: 'relative',
  },

  placeradLapp: {
    position: 'absolute',
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.14)',
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  placeradLappTitel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3b2d1f',
    textAlign: 'center',
  },

  dragOverlayCard: {
    position: 'absolute',
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.14)',
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },

  boardExpansionSpace: {
    height: 420,
  },
});