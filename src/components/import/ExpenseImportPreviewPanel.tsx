import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { importPreviewSummary } from '../../lib/importDashboard';
import type { ExpenseImportPreview } from '../../lib/types';
import { formatCurrency } from '../../lib/utils';

type Props = {
  preview: ExpenseImportPreview;
  fileName?: string | null;
};

export function ExpenseImportPreviewPanel({ preview, fileName }: Props) {
  const { colors } = useTheme();

  return (
    <View style={{ gap: spacing.s2 }}>
      <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>
        {importPreviewSummary(preview, fileName)}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Review everything below before you import.</Text>
      {preview.skippedRows > 0 ? (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
          {preview.skippedRows} row(s) in the file were skipped.
        </Text>
      ) : null}
      {preview.warnings.map((w) => (
        <Text key={w} style={{ color: colors.warning, fontSize: fontSize.xs }}>
          {w}
        </Text>
      ))}
      <View style={[styles.table, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
        <View style={[styles.headerRow, { borderBottomColor: colors.border, backgroundColor: colors.bgPrimary }]}>
          <Text style={[styles.headerCell, styles.colDate, { color: colors.textMuted }]}>Date</Text>
          <Text style={[styles.headerCell, styles.colDesc, { color: colors.textMuted }]}>Description</Text>
          <Text style={[styles.headerCell, styles.colCat, { color: colors.textMuted }]}>Cat.</Text>
          <Text style={[styles.headerCell, styles.colAmt, { color: colors.textMuted }]}>Amount</Text>
        </View>
        {preview.rows.map((row, i) => (
          <View
            key={`${row.date}-${row.description}-${i}`}
            style={[styles.dataRow, i < preview.rows.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
          >
            <Text style={[styles.cell, styles.colDate, { color: colors.textSecondary }]} numberOfLines={1}>
              {row.date}
            </Text>
            <Text style={[styles.cell, styles.colDesc, { color: colors.textPrimary }]} numberOfLines={2}>
              {row.description}
            </Text>
            <Text style={[styles.cell, styles.colCat, { color: colors.textSecondary }]} numberOfLines={1}>
              {row.category}
            </Text>
            <Text style={[styles.cell, styles.colAmt, { color: colors.textPrimary, fontFamily: fonts.medium }]} numberOfLines={1}>
              {formatCurrency(row.amount, row.currency)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.s2,
    paddingHorizontal: spacing.s2,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.s2,
    paddingHorizontal: spacing.s2,
    gap: spacing.s1,
  },
  headerCell: {
    fontSize: fontSize.xs,
    fontFamily: fonts.medium,
  },
  cell: {
    fontSize: fontSize.xs,
  },
  colDate: { width: 72 },
  colDesc: { flex: 1, minWidth: 0 },
  colCat: { width: 56 },
  colAmt: { width: 88, textAlign: 'right' },
});
