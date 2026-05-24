import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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

type TaskDetailModalProps = {
  uppgift: Uppgift | null;
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
  onEdit: () => void;
  onSkip: () => void;
  onMoveToTomorrow: () => void;
  formatDetaljDatum: (uppgift: Uppgift) => string;
  formatUpprepningTextFranRegel: (regel: UpprepningsRegel) => string;
};

export function TaskDetailModal({
  uppgift,
  visible,
  onClose,
  onComplete,
  onEdit,
  onSkip,
  onMoveToTomorrow,
  formatDetaljDatum,
  formatUpprepningTextFranRegel,
}: TaskDetailModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {uppgift && (
              <>
                <View style={styles.detailHeaderRow}>
                  <Text style={styles.modalTitle}>{uppgift.titel}</Text>

                  <View style={styles.headerActionRow}>
                    <Pressable style={styles.iconButton} onPress={onEdit}>
                      <Text style={styles.iconButtonText}>✎</Text>
                    </Pressable>

                    <Pressable style={styles.closeButton} onPress={onClose}>
                      <Text style={styles.closeButtonText}>{'\u00D7'}</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.detailTopMetaRow}>
                  <Text style={styles.detailTopDate}>
                    {formatDetaljDatum(uppgift).replace(/[()]/g, '')}
                  </Text>

                  {uppgift.arViktig && (
                    <Text style={styles.detailImportantText}>Viktig</Text>
                  )}
                </View>

                {uppgift.harStartTid && uppgift.startTid && (
                  <Text style={styles.detailTopTime}>{uppgift.startTid}</Text>
                )}

                <View style={[styles.detailInfoBox, styles.commentSectionSpacing]}>
                  <Text style={styles.detailInfoLabel}>Kommentar</Text>
                  <Text style={styles.detailInfoValue}>
                    {uppgift.kommentar ? uppgift.kommentar : 'Ingen kommentar'}
                  </Text>
                </View>

                <View style={[styles.detailInfoBox, styles.recurrenceSectionSpacing]}>
                  <Text style={styles.detailInfoLabel}>Upprepning</Text>

                  {uppgift.upprepningar && uppgift.upprepningar.length > 0 ? (
                    uppgift.upprepningar.map((regel, index) => (
                      <Text key={index} style={styles.detailInfoValue}>
                        {formatUpprepningTextFranRegel(regel)}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.detailInfoValue}>Ingen upprepning</Text>
                  )}
                </View>

                <View style={[styles.modalButtonColumn, styles.detailButtonSpacing]}>
                  {uppgift.status !== 'avslutad' && (
                    <>
                      <Pressable style={styles.completeButton} onPress={onComplete}>
                        <Text style={styles.completeButtonText}>Klar</Text>
                      </Pressable>

                      <Pressable style={styles.secondaryActionButton} onPress={onSkip}>
                        <Text style={styles.secondaryActionButtonText}>Hoppa över</Text>
                      </Pressable>

                      <Pressable style={styles.secondaryActionButton} onPress={onMoveToTomorrow}>
                        <Text style={styles.secondaryActionButtonText}>Flytta till imorgon</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    padding: 20,
  },

  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    gap: 10,
  },

  detailHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    marginRight: 12,
    color: '#111',
  },

  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e9ecef',
  },

  iconButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
  },

  secondaryActionButton: {
    backgroundColor: '#e9ecef',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },

  secondaryActionButtonText: {
    color: '#222',
    fontWeight: '600',
    fontSize: 16,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    lineHeight: 22,
  },

  detailTopDate: {
    fontSize: 16,
    fontWeight: '700',
    color: '#444',
  },

  detailTopTime: {
    marginTop: 4,
    fontSize: 14,
    color: '#777',
    fontWeight: '500',
  },

  detailInfoBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    gap: 10,
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

  commentSectionSpacing: {
    marginTop: 14,
  },

  recurrenceSectionSpacing: {
    marginTop: 14,
  },

  modalButtonColumn: {
    gap: 12,
  },

  detailButtonSpacing: {
    marginTop: 18,
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
  
  detailTopMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },

  detailImportantText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f4a261',
  },
});