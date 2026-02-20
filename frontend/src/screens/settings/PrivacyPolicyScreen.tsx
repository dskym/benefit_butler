// frontend/src/screens/settings/PrivacyPolicyScreen.tsx
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme";

const sections = [
  {
    title: "제1조 수집하는 개인정보 항목",
    body: "회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.\n\n• 이메일 주소\n• 비밀번호 (암호화하여 저장)\n• 이름\n• 거래 내역 (금액, 날짜, 가맹점, 카테고리)\n• 카드 정보 (카드명, 카드사, 실적 기준)",
  },
  {
    title: "제2조 수집 및 이용 목적",
    body: "수집한 개인정보는 다음의 목적으로만 이용합니다.\n\n• 서비스 제공 및 회원 인증\n• 지출 분석 및 카드 실적 트래킹\n• 서비스 개선 및 신규 기능 개발",
  },
  {
    title: "제3조 보유 및 이용기간",
    body: "개인정보는 회원 탈퇴 시까지 보유하며, 탈퇴 후 즉시 파기합니다. 단, 관계 법령에 의해 보존할 필요가 있는 경우에는 해당 법령에서 정한 기간 동안 보관합니다.",
  },
  {
    title: "제4조 개인정보의 제3자 제공",
    body: "회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 아래의 경우에는 예외로 합니다.\n\n• 이용자가 사전에 동의한 경우\n• 법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우",
  },
  {
    title: "제5조 개인정보 처리 위탁",
    body: "회사는 현재 개인정보 처리를 외부에 위탁하고 있지 않습니다. 향후 위탁이 필요한 경우 사전에 고지하고 동의를 받겠습니다.",
  },
  {
    title: "제6조 이용자의 권리",
    body: "이용자는 언제든지 다음의 권리를 행사할 수 있습니다.\n\n• 개인정보 열람 요청\n• 오류 등이 있을 경우 정정 요청\n• 삭제 요청\n• 처리 정지 요청\n\n권리 행사는 앱 내 설정 화면 또는 아래 개인정보 보호책임자 이메일을 통해 가능하며, 회사는 지체 없이 조치하겠습니다.",
  },
  {
    title: "제7조 개인정보 처리방침의 변경",
    body: "본 처리방침의 내용이 변경되는 경우 시행일로부터 최소 7일 전에 앱 내 공지를 통해 사전 고지합니다. 중요한 변경 사항의 경우 30일 전에 고지합니다.",
  },
  {
    title: "제8조 개인정보 보호책임자",
    body: "개인정보 보호와 관련한 문의, 불만, 조언이나 기타 사항은 아래 연락처로 문의해 주십시오.\n\n• 담당: Benefit Butler 운영팀\n• 이메일: privacy@benefitbutler.com\n\n※ 위 이메일 주소는 플레이스홀더입니다. 실제 배포 전 수정이 필요합니다.",
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.effectiveDate}>시행일: 2026년 2월 21일</Text>
      <Text style={styles.intro}>
        Benefit Butler(이하 "회사")는 이용자의 개인정보를 중요시하며, 「개인정보
        보호법」 등 관련 법령을 준수합니다. 본 방침은 회사가 제공하는 서비스
        이용 과정에서 수집되는 개인정보의 처리 방법 및 보호 조치를 안내합니다.
      </Text>
      {sections.map((section, index) => (
        <View key={index} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.card}>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        </View>
      ))}
      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl * 2 },
  effectiveDate: {
    ...theme.typography.caption,
    color: theme.colors.text.hint,
    marginBottom: theme.spacing.sm,
  },
  intro: {
    ...theme.typography.body,
    color: theme.colors.text.secondary,
    lineHeight: 24,
    marginBottom: theme.spacing.lg,
  },
  section: { marginBottom: theme.spacing.md },
  sectionTitle: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    fontWeight: "700",
    marginBottom: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
  },
  card: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  body: {
    ...theme.typography.body,
    color: theme.colors.text.primary,
    lineHeight: 24,
  },
  footer: { height: theme.spacing.xl },
});
