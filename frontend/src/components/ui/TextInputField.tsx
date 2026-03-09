import React from "react";
import { View, Text, TextInput, StyleSheet, TextInputProps } from "react-native";
import { theme } from "../../theme";

interface TextInputFieldProps extends Omit<TextInputProps, "style"> {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  inputStyle?: TextInputProps["style"];
  containerStyle?: object;
}

export function TextInputField({
  label,
  error,
  hint,
  prefix,
  suffix,
  inputStyle,
  containerStyle,
  ...inputProps
}: TextInputFieldProps) {
  const hasError = !!error;

  return (
    <View style={containerStyle}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, hasError && styles.inputWrapperError]}>
        {prefix && <View style={styles.affix}>{prefix}</View>}
        <TextInput
          style={[styles.input, inputStyle]}
          placeholderTextColor={theme.colors.text.hint}
          accessibilityLabel={inputProps.accessibilityLabel ?? label}
          {...inputProps}
        />
        {suffix && <View style={styles.affix}>{suffix}</View>}
      </View>
      {hasError && <Text style={styles.error}>{error}</Text>}
      {!hasError && hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    marginBottom: 6,
    marginTop: 14,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.bg,
  },
  inputWrapperError: {
    borderColor: theme.colors.expense,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.colors.text.primary,
  },
  affix: {
    paddingHorizontal: 8,
  },
  error: {
    fontSize: 12,
    color: theme.colors.expense,
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    color: theme.colors.text.hint,
    marginTop: 4,
  },
});
