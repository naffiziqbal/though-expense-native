import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DateField } from '../../components/ui/DateField';
import { Screen } from '../../components/ui/Screen';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { fonts, fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { api, getErrorMessage } from '../../lib/api';
import { base64FromArrayBuffer, saveExportedFile } from '../../lib/exportFile';
import { ExpenseImportPreviewPanel } from '../../components/import/ExpenseImportPreviewPanel';
import { ImportAsyncProgressPanel } from '../../components/import/ImportAsyncProgressPanel';
import {
  IMPORT_DATA_HINT,
  isAsyncImportFile,
  isCsvImportFileName,
  type ImportJobPhase,
} from '../../lib/importDashboard';
import { isImportJobGoneError, outcomeFromImportJobStatus } from '../../lib/importJobLifecycle';
import type { ExpenseImportPreview } from '../../lib/types';
import * as DocumentPicker from 'expo-document-picker';
import type { NotificationPreferences } from '../../lib/types';
import { formatCurrency, getImageUrl } from '../../lib/utils';
import { premiumPlansSubtitle } from '../../lib/subscription';
import { useAuthStore } from '../../store/authStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useImportJobStore } from '../../store/importJobStore';
import { useThemeStore, type ThemeMode } from '../../store/themeStore';
import { pushHiddenTab } from '../../lib/hiddenTabNavigation';
import { toast } from '../../store/toastStore';

const PROFILE_TAB: Href = '/(tabs)/profile';

function themeLabel(mode: ThemeMode): string {
  if (mode === 'system') return 'System';
  if (mode === 'dark') return 'Dark';
  return 'Light';
}

type NavRow = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value?: string;
  href: Href;
  last?: boolean;
};

export default function ProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const startTour = useOnboardingStore((s) => s.start);
  const themeMode = useThemeStore((s) => s.mode);
  const isPremium = user?.isPremium ?? false;

  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [recurringCount, setRecurringCount] = useState(0);
  const [budgetHint, setBudgetHint] = useState('Set up');
  const [goalsHint, setGoalsHint] = useState('Create');
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [importSheetOpen, setImportSheetOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ExpenseImportPreview | null>(null);
  const [importParsing, setImportParsing] = useState(false);
  const [importApplying, setImportApplying] = useState(false);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [importPhase, setImportPhase] = useState<ImportJobPhase>('queued');
  const [importMessage, setImportMessage] = useState('');
  const [importProgress, setImportProgress] = useState(0);
  const [importCancelling, setImportCancelling] = useState(false);

  const avatarUrl = getImageUrl(user?.profilePicture || user?.profilePictureUrl);
  const shortId = user?.id?.slice(0, 8).toUpperCase() ?? '—';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const currency = user?.currency || 'USD';
        const [prefsRes, recurringRes, budgetRes, goalsRes] = await Promise.all([
          api.getNotificationPreferences().catch(() => null),
          api.getRecurringRules().catch(() => null),
          api.getCurrentBudget().catch(() => null),
          api.getGoals().catch(() => null),
        ]);
        if (!cancelled && prefsRes?.success) setPrefs(prefsRes.data);
        if (!cancelled && recurringRes?.success) {
          setRecurringCount(recurringRes.data.rules.filter((r) => r.isActive).length);
        }
        if (!cancelled) {
          if (budgetRes?.success && budgetRes.data) {
            setBudgetHint(`${formatCurrency(Math.max(0, budgetRes.data.remaining), currency)} left`);
          } else {
            setBudgetHint('Set up');
          }
          if (goalsRes?.success) {
            const active = goalsRes.data.goals.filter((g) => g.status === 'active').length;
            setGoalsHint(active > 0 ? `${active} active` : 'Create');
          }
        }
      } finally {
        if (!cancelled) setPrefsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.currency]);

  const savePrefs = useCallback(
    async (patch: Partial<NotificationPreferences>) => {
      if (!prefs) return;
      const prev = prefs;
      setPrefs({ ...prefs, ...patch });
      setPrefsSaving(true);
      try {
        const res = await api.updateNotificationPreferences(patch);
        if (res.success) setPrefs(res.data);
      } catch (error) {
        setPrefs(prev);
        toast.error(getErrorMessage(error, 'Could not save preference'));
      } finally {
        setPrefsSaving(false);
      }
    },
    [prefs]
  );

  const copyId = async () => {
    if (!user?.id) return;
    await Clipboard.setStringAsync(user.id);
    toast.success('User ID copied');
  };

  const globalImportJobId = useImportJobStore((s) => s.jobId);
  const globalImportMessage = useImportJobStore((s) => s.message);
  const globalImportPhase = useImportJobStore((s) => s.phase);
  const globalImportProgress = useImportJobStore((s) => s.progress);
  const globalImportFileName = useImportJobStore((s) => s.fileName);
  const startImportJob = useImportJobStore((s) => s.startJob);
  const patchImportJob = useImportJobStore((s) => s.patchJob);
  const clearImportJob = useImportJobStore((s) => s.clearJob);

  const activeJobId = importJobId ?? globalImportJobId;
  const displayMessage = importMessage || globalImportMessage;
  const displayPhase = importJobId ? importPhase : globalImportPhase;
  const displayProgress = importJobId ? importProgress : globalImportProgress;
  const displayFileName = importFileName ?? globalImportFileName;
  const importInProgress =
    !!activeJobId && displayPhase !== 'failed' && displayPhase !== 'cancelled' && displayPhase !== 'done';
  const backgroundImportActive = importInProgress && !importSheetOpen;

  const openImport = () => {
    if (!isPremium) {
      toast.error('Import is available on Premium');
      pushHiddenTab(router, '/premium', PROFILE_TAB);
      return;
    }
    if (importInProgress) {
      setImportSheetOpen(true);
      return;
    }
    setImportPreview(null);
    setImportFileName(null);
    setImportJobId(null);
    setImportPhase('queued');
    setImportMessage('');
    setImportProgress(0);
    setImportSheetOpen(true);
  };

  const resetImportUi = useCallback(() => {
    setImportJobId(null);
    clearImportJob();
    setImportPhase('queued');
    setImportMessage('');
    setImportProgress(0);
    setImportFileName(null);
  }, [clearImportJob]);

  const handleCancelImportJob = async () => {
    const id = activeJobId;
    if (!id || importCancelling) return;
    setImportCancelling(true);
    try {
      const res = await api.cancelImportJob(id);
      toast.success(res.message || 'Import cancelled');
      resetImportUi();
      setImportPhase('cancelled');
      setImportMessage(
        res.message || 'Import cancelled. Nothing new was added from this file.'
      );
    } catch (error) {
      if (isImportJobGoneError(error)) {
        resetImportUi();
        toast.success('Import is no longer running.');
        return;
      }
      toast.error(getErrorMessage(error, 'Could not cancel import'));
    } finally {
      setImportCancelling(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const id = globalImportJobId ?? importJobId;
      if (!id) return;
      let cancelled = false;
      (async () => {
        try {
          const res = await api.getParseJobStatus(id);
          if (cancelled) return;
          const outcome = outcomeFromImportJobStatus(res.data);
          if (outcome.type === 'active') {
            patchImportJob({
              phase: outcome.phase,
              message: outcome.message,
              progress: outcome.progress,
            });
            if (importJobId) {
              if (outcome.phase) setImportPhase(outcome.phase);
              if (outcome.message) setImportMessage(outcome.message);
              if (typeof outcome.progress === 'number') setImportProgress(outcome.progress);
            }
            return;
          }
          resetImportUi();
          if (outcome.type === 'completed') {
            toast.success(outcome.message || 'Import complete');
          }
        } catch (error) {
          if (cancelled) return;
          if (isImportJobGoneError(error)) {
            resetImportUi();
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [globalImportJobId, importJobId, patchImportJob, resetImportUi])
  );

  const pickImportFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/pdf', 'text/plain', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const name = asset.name ?? 'import';
      const mime = asset.mimeType || 'application/octet-stream';
      setImportFileName(name);
      setImportPreview(null);
      setImportJobId(null);

      if (isCsvImportFileName(name, mime)) {
        setImportParsing(true);
        try {
          const res = await api.previewExpenseImport(asset.uri, mime, name);
          if (res.success) setImportPreview(res.data);
        } catch (error) {
          toast.error(getErrorMessage(error, 'Could not read file'));
        } finally {
          setImportParsing(false);
        }
        return;
      }

      if (!isAsyncImportFile(name, mime)) {
        toast.error('Choose CSV, PDF, or an image scan');
        return;
      }

      setImportParsing(true);
      setImportPhase('queued');
      setImportMessage('Uploading your document…');
      setImportProgress(0);
      try {
        const res = await api.enqueueImportDocument(asset.uri, mime, name);
        if (res.success) {
          const msg = res.data.message || 'Import started — reading your document…';
          setImportJobId(res.data.jobId);
          setImportMessage(msg);
          startImportJob(res.data.jobId, name, msg);
        }
      } catch (error) {
        toast.error(getErrorMessage(error, 'Could not start import'));
        setImportPhase('failed');
        setImportMessage(getErrorMessage(error, 'Could not start import'));
      } finally {
        setImportParsing(false);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not open file picker'));
    }
  };

  const handleApplyImport = async () => {
    if (!importPreview?.rows.length) return;
    setImportApplying(true);
    try {
      const res = await api.applyExpenseImport(importPreview.rows);
      toast.success(res.message || `Imported ${res.data.imported} expenses`);
      setImportSheetOpen(false);
      setImportPreview(null);
      setImportFileName(null);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Import failed'));
    } finally {
      setImportApplying(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const buffer = await api.exportExpenses(exportFormat, exportFrom || undefined, exportTo || undefined);
      const result = await saveExportedFile({
        base64: base64FromArrayBuffer(buffer),
        baseName: `expenses-${new Date().toISOString().slice(0, 10)}`,
        extension: exportFormat,
        mimeType: exportFormat === 'csv' ? 'text/csv' : 'application/pdf',
      });
      if (result.status === 'unavailable') {
        toast.error('Sharing is not available on this device');
        return;
      }
      setExportSheetOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Export failed'));
    } finally {
      setIsExporting(false);
    }
  };

  const moneyRows: NavRow[] = [
    {
      icon: 'bar-chart-outline',
      title: 'Monthly budget',
      value: budgetHint,
      href: '/budget',
    },
    {
      icon: 'flag-outline',
      title: 'Savings goals',
      value: goalsHint,
      href: '/goals',
    },
    {
      icon: 'cash-outline',
      title: 'Currency',
      value: user?.currency || 'USD',
      href: '/currencies',
    },
    {
      icon: 'repeat',
      title: 'Recurring',
      value: recurringCount > 0 ? `${recurringCount} active` : 'Auto-log',
      href: '/recurring',
      last: true,
    },
  ];

  const renderNavRow = (row: NavRow) => (
    <Pressable
      key={row.title}
      onPress={() => pushHiddenTab(router, row.href, PROFILE_TAB)}
      style={[styles.row, !row.last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
    >
      <Ionicons name={row.icon} size={20} color={colors.textMuted} />
      <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{row.title}</Text>
      {row.value ? <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{row.value}</Text> : null}
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );

  return (
    <Screen safeTop>
      {/* Profile header */}
      <View style={styles.headerRow}>
        <View style={[styles.avatarSm, { backgroundColor: colors.accent }]}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarSmImage} contentFit="cover" />
          ) : (
            <Text style={styles.avatarSmInitial}>
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
            </Text>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.textPrimary, fontSize: fontSize.md, fontFamily: fonts.medium }} numberOfLines={1}>
            {user?.name || 'User'}
          </Text>
          <Pressable onPress={copyId} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>ID {shortId}</Text>
            <Ionicons name="copy-outline" size={12} color={colors.textMuted} />
          </Pressable>
        </View>
        <Pressable
          onPress={() => pushHiddenTab(router, '/profile-edit', PROFILE_TAB)}
          style={[styles.editBtn, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm, fontFamily: fonts.medium }}>Edit</Text>
        </Pressable>
      </View>

      {/* Plan card */}
      <Card style={[styles.planCard, { borderColor: `${colors.accent}55`, backgroundColor: colors.bgCard }]}>
        <Ionicons name="star" size={20} color={colors.accent} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.textPrimary, fontFamily: fonts.medium, fontSize: fontSize.sm }}>
            {isPremium ? 'Premium plan' : 'Free plan'}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }} numberOfLines={1}>
            {isPremium ? user?.subscription?.summaryLine || premiumPlansSubtitle(user) : 'Upgrade to unlock all features'}
          </Text>
        </View>
        {!isPremium ? (
          <Pressable onPress={() => pushHiddenTab(router, '/premium', PROFILE_TAB)} style={[styles.seePlansBtn, { backgroundColor: colors.accent }]}>
            <Text style={{ color: colors.onAccent, fontSize: fontSize.sm, fontFamily: fonts.medium }}>See plans</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => pushHiddenTab(router, '/premium', PROFILE_TAB)} style={[styles.editBtn, { borderColor: colors.border }]}>
            <Text style={{ color: colors.textPrimary, fontSize: fontSize.sm }}>Manage</Text>
          </Pressable>
        )}
      </Card>

      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Money</Text>
      <Card padded={false}>{moneyRows.map(renderNavRow)}</Card>

      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Preferences</Text>
      <Card padded={false}>
        <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
          <Ionicons name="notifications-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Budget alerts</Text>
          {prefsLoading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Switch
              value={prefs?.budgetAlertsEnabled ?? false}
              disabled={prefsSaving || !prefs?.pushEnabled}
              onValueChange={(v) => savePrefs({ budgetAlertsEnabled: v })}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor={colors.bgCard}
            />
          )}
        </View>
        <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
          <Ionicons name="sparkles-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Weekly AI briefing</Text>
          {prefsLoading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Switch
              value={prefs?.pushEnabled ?? false}
              disabled={prefsSaving}
              onValueChange={(v) => savePrefs({ pushEnabled: v })}
              trackColor={{ true: colors.accent, false: colors.border }}
              thumbColor={colors.bgCard}
            />
          )}
        </View>
        <Pressable
          onPress={() => pushHiddenTab(router, '/device-settings', PROFILE_TAB)}
          style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
        >
          <Ionicons name="moon-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Appearance</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{themeLabel(themeMode)}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
        <Pressable onPress={() => pushHiddenTab(router, '/security', PROFILE_TAB)} style={styles.row}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Security</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Password</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      </Card>

      {backgroundImportActive ? (
        <Card style={{ marginBottom: spacing.s3, gap: spacing.s2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s2 }}>
            <ActivityIndicator size="small" color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: fontSize.sm }}>
                Import in progress
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }} numberOfLines={2}>
                {displayFileName ? `${displayFileName} · ` : ''}
                {displayMessage || 'Working on your file…'}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.s2 }}>
            <Button
              title="View"
              variant="outline"
              style={{ flex: 1 }}
              onPress={() => setImportSheetOpen(true)}
            />
            <Button
              title={importCancelling ? 'Cancelling…' : 'Cancel import'}
              variant="outline"
              style={{ flex: 1 }}
              onPress={() => void handleCancelImportJob()}
              loading={importCancelling}
              disabled={importCancelling}
            />
          </View>
        </Card>
      ) : null}

      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Data and help</Text>
      <Card padded={false}>
        <Pressable
          onPress={openImport}
          style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
        >
          <Ionicons name="cloud-upload-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Import data</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            {isPremium ? (importInProgress ? 'Importing…' : 'CSV / PDF') : 'Premium'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
        <Pressable
          onPress={() => setExportSheetOpen(true)}
          style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
        >
          <Ionicons name="download-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Export data</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>CSV</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
        <Pressable onPress={startTour} style={styles.row}>
          <Ionicons name="help-circle-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Replay the tour</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      </Card>

      <Pressable onPress={() => setLogoutConfirm(true)} style={styles.logoutRow}>
        <Ionicons name="log-out-outline" size={18} color={colors.error} />
        <Text style={{ color: colors.error, fontFamily: fonts.medium, fontSize: fontSize.sm }}>Log out</Text>
      </Pressable>

      <BottomSheet
        visible={importSheetOpen}
        onClose={() => {
          setImportSheetOpen(false);
          setImportPreview(null);
          setImportFileName(null);
          if (activeJobId) toast.success('Import continues in the background.');
        }}
        title={activeJobId ? 'Import in progress' : importPreview ? 'Review import' : 'Import Expenses'}
      >
        <View style={{ gap: spacing.s3 }}>
          {activeJobId || displayPhase === 'failed' || displayPhase === 'cancelled' ? (
            <ImportAsyncProgressPanel
              fileName={displayFileName}
              phase={displayPhase}
              message={displayMessage}
              progress={displayProgress}
            />
          ) : null}
          {!importPreview && !activeJobId && displayPhase !== 'failed' && displayPhase !== 'cancelled' ? (
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 }}>{IMPORT_DATA_HINT}</Text>
          ) : null}
          {!importPreview && !activeJobId && displayPhase !== 'failed' && displayPhase !== 'cancelled' ? (
            <Button
              title={importParsing ? 'Reading…' : 'Choose CSV, PDF, or photo'}
              variant="outline"
              onPress={pickImportFile}
              loading={importParsing}
              disabled={importApplying}
            />
          ) : null}
          {importPreview ? <ExpenseImportPreviewPanel preview={importPreview} fileName={importFileName} /> : null}
          {importPreview ? (
            <Button
              title="Choose another file"
              variant="outline"
              onPress={() => {
                setImportPreview(null);
                setImportFileName(null);
                void pickImportFile();
              }}
              disabled={importParsing || importApplying}
            />
          ) : null}
          {(displayPhase === 'failed' || displayPhase === 'cancelled') && !activeJobId ? (
            <Button
              title="Try another file"
              variant="outline"
              onPress={() => {
                setImportPhase('queued');
                setImportMessage('');
                setImportProgress(0);
                setImportFileName(null);
                clearImportJob();
              }}
            />
          ) : null}
          {importInProgress ? (
            <View style={{ flexDirection: 'row', gap: spacing.s2 }}>
              <Button
                title={importCancelling ? 'Cancelling…' : 'Cancel import'}
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => void handleCancelImportJob()}
                loading={importCancelling}
                disabled={importCancelling}
              />
              <Button
                title="Close"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => {
                  setImportSheetOpen(false);
                  setImportJobId(null);
                  toast.success('Import continues in the background.');
                }}
              />
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: spacing.s2 }}>
              <Button
                title="Cancel"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => {
                  setImportSheetOpen(false);
                  setImportPreview(null);
                  setImportFileName(null);
                }}
              />
              <Button
                title={
                  importApplying
                    ? 'Importing…'
                    : importPreview?.rows.length
                      ? `Import ${importPreview.rows.length}`
                      : 'Import'
                }
                style={{ flex: 1 }}
                onPress={handleApplyImport}
                loading={importApplying}
                disabled={!importPreview?.rows.length || importParsing}
              />
            </View>
          )}
        </View>
      </BottomSheet>

      <BottomSheet visible={exportSheetOpen} onClose={() => setExportSheetOpen(false)} title="Export Expenses">
        <View style={{ gap: spacing.s3 }}>
          <SegmentedControl
            segments={[
              { value: 'csv', label: 'CSV' },
              { value: 'pdf', label: 'PDF' },
            ]}
            value={exportFormat}
            onChange={(v) => setExportFormat(v as 'csv' | 'pdf')}
          />
          <DateField label="From (optional)" value={exportFrom} onChange={setExportFrom} clearable />
          <DateField label="To (optional)" value={exportTo} onChange={setExportTo} clearable />
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>
            Leave dates empty to export all expenses. You will pick where to save the file.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.s2 }}>
            <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setExportSheetOpen(false)} />
            <Button
              title={isExporting ? 'Exporting…' : 'Export'}
              style={{ flex: 1 }}
              onPress={handleExport}
              loading={isExporting}
            />
          </View>
        </View>
      </BottomSheet>

      <BottomSheet visible={logoutConfirm} onClose={() => setLogoutConfirm(false)} title="Log out?">
        <View style={{ gap: spacing.s3 }}>
          <Text style={{ color: colors.textSecondary }}>You’ll need to sign in again to access your expenses.</Text>
          <View style={{ flexDirection: 'row', gap: spacing.s2 }}>
            <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setLogoutConfirm(false)} />
            <Button
              title="Log out"
              variant="danger"
              style={{ flex: 1 }}
              onPress={async () => {
                setLogoutConfirm(false);
                await logout();
                router.replace('/(auth)/login');
              }}
            />
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    marginBottom: spacing.s4,
  },
  avatarSm: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarSmImage: {
    width: 56,
    height: 56,
  },
  avatarSmInitial: {
    color: '#fff',
    fontSize: 22,
    fontFamily: fonts.medium,
  },
  editBtn: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    borderWidth: 1,
    marginBottom: spacing.s4,
  },
  seePlansBtn: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontFamily: fonts.medium,
    marginBottom: spacing.s2,
    marginLeft: spacing.s1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s3,
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s3,
    minHeight: 52,
  },
  rowTitle: {
    flex: 1,
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s2,
    paddingVertical: spacing.s4,
    marginTop: spacing.s2,
  },
});
