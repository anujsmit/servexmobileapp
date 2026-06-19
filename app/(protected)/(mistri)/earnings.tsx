import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
} from 'react-native';
import {
    mistriDashboardColors as DC,
    mistriDashboardElevation as MISTRI_ELEV,
} from '../../../lib/mistriDashboardTokens';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEarningsQuery } from '../../../hooks/queries';
import { LineChart } from 'react-native-chart-kit';
import { SafeAreaContainer } from '../../../components/SafeAreaContainer';
import { useMistriTradeTheme } from '../../../context/MistriTradeThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Period = 'week' | 'month' | 'year' | 'all';

export default function EarningsPage() {
    const router = useRouter();
    const trade = useMistriTradeTheme();
    const [selectedPeriod, setSelectedPeriod] = useState<Period>('month');

    const { data, isLoading, refetch, isFetching } = useEarningsQuery(selectedPeriod);

    const periods: { id: Period; label: string }[] = [
        { id: 'week', label: 'Week' },
        { id: 'month', label: 'Month' },
        { id: 'year', label: 'Year' },
        { id: 'all', label: 'All Time' },
    ];

    const formatCurrency = (amount: number) => {
        return `Rs. ${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    const formatDateLong = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const chartData = useMemo(() => {
        if (!data?.trend || data.trend.length === 0) {
            return null;
        }
        const trendData = data.trend.slice(-7);
        return {
            labels: trendData.map(t => formatDate(t.date)),
            datasets: [{
                data: trendData.map(t => t.amount),
                color: (opacity = 1) => `rgba(${trade.accentRgb}, ${opacity})`,
                strokeWidth: 2
            }]
        };
    }, [data?.trend, trade.accentRgb]);

    const lineChartConfig = useMemo(
        () => ({
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(${trade.accentRgb}, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(113, 113, 122, ${opacity})`,
            style: {
                borderRadius: 16,
            },
            propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: trade.accent,
            },
            propsForBackgroundLines: {
                strokeDasharray: '',
                stroke: 'rgba(15, 23, 42, 0.08)',
                strokeWidth: 1,
            },
        }),
        [trade.accent, trade.accentRgb]
    );

    return (
        <SafeAreaContainer style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <MaterialIcons name="arrow-back" size={24} color={DC.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Earnings</Text>
                <View style={styles.headerRight} />
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isFetching && !isLoading}
                        onRefresh={refetch}
                        tintColor={trade.accent}
                        colors={[trade.accent]}
                    />
                }
            >
                {/* Period Selector */}
                <View style={styles.periodSelector}>
                    {periods.map((period) => (
                        <TouchableOpacity
                            key={period.id}
                            style={[
                                styles.periodButton,
                                selectedPeriod === period.id && styles.periodButtonActive,
                                selectedPeriod === period.id && {
                                    backgroundColor: trade.accent,
                                    borderColor: trade.accent,
                                },
                            ]}
                            onPress={() => setSelectedPeriod(period.id)}
                        >
                            <Text
                                style={[
                                    styles.periodButtonText,
                                    selectedPeriod === period.id && styles.periodButtonTextActive,
                                ]}
                            >
                                {period.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={trade.accent} />
                        <Text style={styles.loadingText}>Loading earnings data...</Text>
                    </View>
                ) : !data ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="account-balance-wallet" size={48} color={DC.muted} />
                        <Text style={styles.emptyStateText}>No earnings data available</Text>
                    </View>
                ) : (
                    <>
                        {/* Total Earnings Hero Card */}
                        <View style={styles.heroCard}>
                            <View style={[styles.heroIconCircle, { backgroundColor: trade.accentSoft }]}>
                                <MaterialIcons name="account-balance-wallet" size={32} color={trade.accent} />
                            </View>
                            <Text style={[styles.heroAmount, { color: trade.accent }]}>
                                {formatCurrency(data.summary.totalEarnings)}
                            </Text>
                            <Text style={styles.heroLabel}>Total Earnings</Text>
                            <Text style={styles.heroPeriod}>
                                {selectedPeriod === 'week' && 'This Week'}
                                {selectedPeriod === 'month' && 'This Month'}
                                {selectedPeriod === 'year' && 'This Year'}
                                {selectedPeriod === 'all' && 'All Time'}
                            </Text>
                        </View>

                        {/* Stats Row */}
                        <View style={styles.statsRow}>
                            <View style={[styles.statCard, { backgroundColor: '#d1fae5' }]}>
                                <View style={[styles.statIcon, { backgroundColor: '#059669' }]}>
                                    <MaterialIcons name="check-circle" size={20} color="#ffffff" />
                                </View>
                                <Text style={[styles.statValue, { color: '#059669' }]}>
                                    {formatCurrency(data.summary.paidEarnings)}
                                </Text>
                                <Text style={styles.statLabel}>Paid</Text>
                                <Text style={styles.statSubtext}>{data.summary.paidJobs} jobs</Text>
                            </View>

                            <View style={[styles.statCard, { backgroundColor: '#fed7aa' }]}>
                                <View style={[styles.statIcon, { backgroundColor: '#d97706' }]}>
                                    <MaterialIcons name="pending" size={20} color="#ffffff" />
                                </View>
                                <Text style={[styles.statValue, { color: '#d97706' }]}>
                                    {formatCurrency(data.summary.unpaidEarnings)}
                                </Text>
                                <Text style={styles.statLabel}>Pending</Text>
                                <Text style={styles.statSubtext}>{data.summary.unpaidJobs} jobs</Text>
                            </View>

                            <View style={[styles.statCard, { backgroundColor: trade.accentSoft }]}>
                                <View style={[styles.statIcon, { backgroundColor: trade.accent }]}>
                                    <MaterialIcons name="assignment" size={20} color="#ffffff" />
                                </View>
                                <Text style={[styles.statValue, { color: trade.accent }]}>
                                    {data.summary.totalJobs}
                                </Text>
                                <Text style={styles.statLabel}>Total Jobs</Text>
                                <Text style={styles.statSubtext}>
                                    {formatCurrency(data.summary.averagePerJob)} avg
                                </Text>
                            </View>
                        </View>

                        {/* Earnings Trend Chart */}
                        {chartData && chartData.datasets[0].data.length > 0 && (
                            <View style={styles.chartSection}>
                                <Text style={styles.sectionTitle}>Earnings Trend</Text>
                                <View style={styles.chartCard}>
                                    <LineChart
                                        data={chartData}
                                        width={SCREEN_WIDTH - 56}
                                        height={200}
                                        chartConfig={lineChartConfig}
                                        bezier
                                        style={styles.chart}
                                        withInnerLines={true}
                                        withOuterLines={false}
                                        withVerticalLabels={true}
                                        withHorizontalLabels={true}
                                        withVerticalLines={false}
                                        withHorizontalLines={true}
                                        fromZero
                                    />
                                </View>
                            </View>
                        )}

                        {/* Recent Transactions */}
                        <View style={styles.transactionsSection}>
                            <Text style={styles.sectionTitle}>Recent Transactions</Text>
                            {data.jobs.length === 0 ? (
                                <View style={styles.emptyTransactions}>
                                    <MaterialIcons name="receipt-long" size={40} color="#9ca3af" />
                                    <Text style={styles.emptyTransactionsText}>No transactions yet</Text>
                                </View>
                            ) : (
                                <View style={styles.transactionsList}>
                                    {data.jobs.map((job) => (
                                        <TouchableOpacity
                                            key={job.id}
                                            style={styles.transactionCard}
                                            onPress={() => router.push({
                                                pathname: '/(protected)/(mistri)/job-details',
                                                params: { requestId: job.id }
                                            })}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.transactionLeft}>
                                                <View style={[styles.transactionIcon, { backgroundColor: trade.accentSoft }]}>
                                                    <MaterialIcons name="build" size={20} color={trade.accent} />
                                                </View>
                                                <View style={styles.transactionInfo}>
                                                    <Text style={styles.transactionType}>
                                                        {job.type.charAt(0).toUpperCase() + job.type.slice(1)}
                                                    </Text>
                                                    <Text style={styles.transactionCustomer}>
                                                        for {job.customerName}
                                                    </Text>
                                                    <View style={styles.transactionMeta}>
                                                        <Text style={styles.transactionDate}>
                                                            {formatDateLong(job.completedAt)}
                                                        </Text>
                                                        <Text style={styles.transactionSeparator}>•</Text>
                                                        <Text style={styles.transactionServices}>
                                                            {job.services.length} service{job.services.length !== 1 ? 's' : ''}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                            <View style={styles.transactionRight}>
                                                <Text style={styles.transactionAmount}>
                                                    {formatCurrency(job.amount)}
                                                </Text>
                                                <View
                                                    style={[
                                                        styles.transactionStatus,
                                                        job.isPaid
                                                            ? styles.transactionStatusPaid
                                                            : styles.transactionStatusPending,
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.transactionStatusText,
                                                            job.isPaid
                                                                ? styles.transactionStatusTextPaid
                                                                : styles.transactionStatusTextPending,
                                                        ]}
                                                    >
                                                        {job.isPaid ? 'Paid' : 'Pending'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaContainer>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: DC.surface,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: DC.surface,
        borderBottomWidth: 0,
        boxShadow: MISTRI_ELEV.header,
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 21,
        fontWeight: '700',
        letterSpacing: -0.45,
        color: DC.text,
    },
    headerRight: {
        width: 40,
    },
    content: {
        flex: 1,
        backgroundColor: DC.canvas,
    },
    periodSelector: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 14,
    },
    periodButton: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderCurve: 'continuous',
        backgroundColor: DC.surface,
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.06)',
        alignItems: 'center',
    },
    periodButtonActive: {},
    periodButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: DC.muted,
    },
    periodButtonTextActive: {
        color: '#ffffff',
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    loadingText: {
        fontSize: 14,
        color: DC.muted,
        marginTop: 12,
    },
    emptyState: {
        backgroundColor: DC.surface,
        padding: 40,
        marginHorizontal: 16,
        marginTop: 14,
        borderRadius: 16,
        borderCurve: 'continuous',
        alignItems: 'center',
        borderWidth: 0,
        boxShadow: MISTRI_ELEV.card,
    },
    emptyStateText: {
        fontSize: 14,
        fontWeight: '600',
        color: DC.muted,
        marginTop: 12,
    },
    heroCard: {
        backgroundColor: DC.surface,
        marginHorizontal: 16,
        marginBottom: 14,
        padding: 24,
        borderRadius: 16,
        borderCurve: 'continuous',
        alignItems: 'center',
        borderWidth: 0,
        boxShadow: MISTRI_ELEV.card,
        elevation: 2,
    },
    heroIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    heroAmount: {
        fontSize: 36,
        fontWeight: '800',
        marginBottom: 4,
    },
    heroLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: DC.muted,
        marginBottom: 4,
    },
    heroPeriod: {
        fontSize: 12,
        color: DC.muted,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    statCard: {
        flex: 1,
        padding: 14,
        borderRadius: 16,
        borderCurve: 'continuous',
        alignItems: 'center',
        borderWidth: 0,
        boxShadow: MISTRI_ELEV.card,
    },
    statIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: DC.muted,
        marginBottom: 2,
    },
    statSubtext: {
        fontSize: 10,
        color: DC.muted,
    },
    chartSection: {
        paddingHorizontal: 16,
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: -0.3,
        color: DC.text,
        marginBottom: 10,
    },
    chartCard: {
        backgroundColor: DC.surface,
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 12,
        borderWidth: 0,
        boxShadow: MISTRI_ELEV.card,
        alignItems: 'center',
    },
    chart: {
        borderRadius: 16,
    },
    transactionsSection: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    emptyTransactions: {
        backgroundColor: DC.surface,
        padding: 32,
        borderRadius: 16,
        borderCurve: 'continuous',
        alignItems: 'center',
        borderWidth: 0,
        boxShadow: MISTRI_ELEV.card,
    },
    emptyTransactionsText: {
        fontSize: 14,
        color: DC.muted,
        marginTop: 8,
    },
    transactionsList: {
        gap: 10,
    },
    transactionCard: {
        backgroundColor: DC.surface,
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 14,
        borderWidth: 0,
        boxShadow: MISTRI_ELEV.card,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    transactionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    transactionIcon: {
        width: 44,
        height: 44,
        borderRadius: 13,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    transactionInfo: {
        flex: 1,
    },
    transactionType: {
        fontSize: 15,
        fontWeight: '600',
        color: DC.text,
        marginBottom: 2,
    },
    transactionCustomer: {
        fontSize: 12,
        color: DC.muted,
        marginBottom: 4,
    },
    transactionMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    transactionDate: {
        fontSize: 12,
        color: DC.muted,
    },
    transactionSeparator: {
        fontSize: 12,
        color: DC.muted,
        marginHorizontal: 6,
    },
    transactionServices: {
        fontSize: 12,
        color: DC.muted,
    },
    transactionRight: {
        alignItems: 'flex-end',
        marginLeft: 12,
    },
    transactionAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: DC.text,
        marginBottom: 6,
    },
    transactionStatus: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    transactionStatusPaid: {
        backgroundColor: '#d1fae5',
    },
    transactionStatusPending: {
        backgroundColor: '#fed7aa',
    },
    transactionStatusText: {
        fontSize: 11,
        fontWeight: '600',
    },
    transactionStatusTextPaid: {
        color: '#059669',
    },
    transactionStatusTextPending: {
        color: '#d97706',
    },
});
