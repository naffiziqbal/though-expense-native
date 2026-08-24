import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, fontSize, spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import type { Expense } from '../lib/types';
import { cleanExpenseDescription, formatCurrency, formatRelativeDate } from '../lib/utils';
import { Card } from './ui/Card';
import { CategoryBadge } from './ui/CategoryBadge';

interface ExpenseCardProps {
  expense: Expense;
  onPress?: () => void;
  onDelete?: () => void;
}

export function ExpenseCard({ expense, onPress, onDelete }: ExpenseCardProps) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.left}>
          <Text style={[styles.description, { color: colors.textPrimary }]} numberOfLines={1}>
            {cleanExpenseDescription(expense.description)}
          </Text>
          <View style={styles.metaRow}>
            <CategoryBadge category={expense.category} />
            <Text style={[styles.date, { color: colors.textMuted }]}>{formatRelativeDate(expense.date)}</Text>
          </View>
        </View>
        <View style={styles.right}>
          <Text style={[styles.amount, { color: colors.textPrimary }]}>
            {formatCurrency(expense.amount, expense.currency)}
          </Text>
          {onDelete ? (
            <Pressable onPress={onDelete} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </Pressable>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.s3,
  },
  left: {
    flex: 1,
    gap: spacing.s1,
    marginRight: spacing.s2,
  },
  description: {
    fontSize: fontSize.md,
    fontFamily: fonts.medium,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s2,
  },
  date: {
    fontSize: fontSize.xs,
  },
  right: {
    alignItems: 'flex-end',
    gap: spacing.s2,
  },
  amount: {
    fontSize: fontSize.md,
    fontFamily: fonts.bold,
  },
});
