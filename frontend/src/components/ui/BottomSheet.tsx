import React from "react";
import { Modal, View, Text, ScrollView, StyleSheet } from "react-native";
import { theme } from "../../theme";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  maxHeight?: string;
  children: React.ReactNode;
}

export function BottomSheet({
  visible,
  onClose,
  title,
  maxHeight = "85%",
  children,
}: BottomSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { maxHeight: maxHeight as any }]}>
          <View style={styles.handle} accessibilityLabel="모달 핸들">
            <View style={styles.handleBar} />
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {title && <Text style={styles.title}>{title}</Text>}
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: `rgba(0,0,0,${theme.opacity.overlay})`,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.lg,
  },
  handle: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.text.primary,
    marginBottom: 20,
  },
});
