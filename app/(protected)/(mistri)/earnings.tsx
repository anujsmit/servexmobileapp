// app/(protected)/(mistri)/earnings.tsx
import React, { useState, useMemo, useCallback } from 'react';
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
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEarningsQuery } from '../../../hooks/queries';
import { LineChart } from 'react-native-chart-kit';
import { SafeAreaContainer } from '../../../components/SafeAreaContainer';
import { useMistriTradeTheme } from '../../../context/MistriTradeThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

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
        { id: 'all', label: 'All' },
    ];

    const formatCurrency = (amount: number) => {
        return `रु ${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    };

    const formatShortDate = (dateString: string) => {
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
            labels: trendData.map(t => formatShortDate(t.date)),
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
            labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
            style: {
                borderRadius: 16,
            },
            propsForDots: {
                r: '5',
                strokeWidth: '2',
                stroke: trade.accent,
            },
            propsForBackgroundLines: {
                strokeDasharray: '',
                stroke: 'rgba(15, 23, 42, 0.06)',
                strokeWidth: 1,
            },
        }),
        [trade.accent, trade.accentRgb]
    );

    const getPeriodLabel = () => {
        switch (selectedPeriod) {
            case 'week': return 'This Week';
            case 'month': return 'This Month';
            case 'year': return 'This Year';
            case 'all': return 'All Time';
        }
    };

    const handleBack = useCallback(() => {
        router.back();
    }, [router]);

    if (isLoading) {
        return (
            <SafeAreaContainer style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={trade.accent} />
                    <Text style={styles.loadingText}>Loading earnings data...</Text>
                </View>
            </SafeAreaContainer>
        );
    }

    return (
        <SafeAreaContainer style={styles.container}>
            {/* Header */}
            <LinearGradient
                colors={['#ffffff', '#f8fafc']}
                style={styles.header}
            >
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        onPress={handleBack}
                        style={styles.backButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="arrow-back" size={24} color={DC.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Earnings</Text>
                    <View style={styles.headerRight} />
                </View>
            </LinearGradient>

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

                {!data ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="account-balance-wallet" size={48} color={DC.muted} />
                        <Text style={styles.emptyStateText}>No earnings data available</Text>
                    </View>
                ) : (
                    <>
                        {/* Total Earnings Hero Card */}
                        <View style={styles.heroCard}>
                            <LinearGradient
                                colors={[trade.accent + '15', trade.accent + '05']}
                                style={styles.heroGradient}
                            >
                                <View style={[styles.heroIconCircle, { backgroundColor: trade.accent }]}>
                                    <MaterialIcons name="account-balance-wallet" size={28} color="#ffffff" />
                                </View>
                                <Text style={styles.heroLabel}>Total Earnings</Text>
                                <Text style={[styles.heroAmount, { color: trade.accent }]}>
                                    {formatCurrency(data.summary.totalEarnings)}
                                </Text>
                                <Text style={styles.heroPeriod}>{getPeriodLabel()}</Text>
                            </LinearGradient>
                        </View>

                        {/* Stats Row */}
                        <View style={styles.statsRow}>
                            <View style={styles.statCard}>
                                <View style={[styles.statIcon, { backgroundColor: '#10b981', opacity: 0.9 }]}>
                                    <MaterialIcons name="check-circle" size={20} color="#ffffff" />
                                </View>
                                <Text style={styles.statValue}>{formatCurrency(data.summary.paidEarnings)}</Text>
                                <Text style={styles.statLabel}>Paid</Text>
                                <Text style={styles.statSubtext}>{data.summary.paidJobs} jobs</Text>
                            </View>

                            <View style={styles.statCard}>
                                <View style={[styles.statIcon, { backgroundColor: '#f59e0b', opacity: 0.9 }]}>
                                    <MaterialIcons name="pending" size={20} color="#ffffff" />
                                </View>
                                <Text style={styles.statValue}>{formatCurrency(data.summary.unpaidEarnings)}</Text>
                                <Text style={styles.statLabel}>Pending</Text>
                                <Text style={styles.statSubtext}>{data.summary.unpaidJobs} jobs</Text>
                            </View>

                            <View style={styles.statCard}>
                                <View style={[styles.statIcon, { backgroundColor: trade.accent, opacity: 0.9 }]}>
                                    <MaterialIcons name="assignment" size={20} color="#ffffff" />
                                </View>
                                <Text style={styles.statValue}>{data.summary.totalJobs}</Text>
                                <Text style={styles.statLabel}>Total Jobs</Text>
                                <Text style={styles.statSubtext}>{formatCurrency(data.summary.averagePerJob)} avg</Text>
                            </View>
                        </View>

                        {/* Earnings Trend Chart */}
                        {chartData && chartData.datasets[0].data.length > 0 && (
                            <View style={styles.chartSection}>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>Earnings Trend</Text>
                                    <View style={[styles.trendBadge, { backgroundColor: trade.accent + '10' }]}>
                                        <MaterialIcons name="trending-up" size={14} color={trade.accent} />
                                        <Text style={[styles.trendText, { color: trade.accent }]}>Last 7 days</Text>
                                    </View>
                                </View>
                                <View style={styles.chartCard}>
                                    <LineChart
                                        data={chartData}
                                        width={SCREEN_WIDTH - 48}
                                        height={220}
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
                                        formatYLabel={(value) => `रु ${parseInt(value).toLocaleString()}`}
                                    />
                                </View>
                            </View>
                        )}

                        {/* Recent Transactions */}
                        <View style={styles.transactionsSection}>
                            <Text style={styles.sectionTitle}>Recent Transactions</Text>
                            {data.jobs.length === 0 ? (
                                <View style={styles.emptyTransactions}>
                                    <MaterialIcons name="receipt-long" size={40} color={DC.muted} />
                                    <Text style={styles.emptyTransactionsText}>No transactions yet</Text>
                                </View>
                            ) : (
                                <View style={styles.transactionsList}>
                                    {data.jobs.slice(0, 10).map((job, index) => (
                                        <TouchableOpacity
                                            key={job.id}
                                            style={[
                                                styles.transactionCard,
                                                index === data.jobs.length - 1 && styles.transactionCardLast
                                            ]}
                                            onPress={() => router.push({
                                                pathname: '/(protected)/(mistri)/job-details',
                                                params: { requestId: job.id }
                                            })}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.transactionLeft}>
                                                <View style={[styles.transactionIcon, { backgroundColor: trade.accent + '15' }]}>
                                                    <MaterialIcons name="build" size={20} color={trade.accent} />
                                                </View>
                                                <View style={styles.transactionInfo}>
                                                    <Text style={styles.transactionType}>
                                                        {job.type.charAt(0).toUpperCase() + job.type.slice(1)}
                                                    </Text>
                                                    <Text style={styles.transactionCustomer}>
                                                        {job.customerName}
                                                    </Text>
                                                    <Text style={styles.transactionDate}>
                                                        {formatDateLong(job.completedAt)}
                                                    </Text>
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
                <View style={{ height: 20 }} />
            </ScrollView>
        </SafeAreaContainer>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: DC.canvas,
    },
    header: {
        paddingTop: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(15, 23, 42, 0.06)',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: -0.4,
        color: DC.text,
    },
    headerRight: {
        width: 40,
    },
    content: {
        flex: 1,
    },
    periodSelector: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 16,
    },
    periodButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
        elevation: 1,
    },
    periodButtonActive: {
        borderWidth: 0,
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    periodButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: DC.muted,
    },
    periodButtonTextActive: {
        color: '#ffffff',
    },
    loadingContainer: {
        flex: 1,
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
        backgroundColor: '#ffffff',
        padding: 40,
        marginHorizontal: 16,
        marginTop: 20,
        borderRadius: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    emptyStateText: {
        fontSize: 14,
        fontWeight: '500',
        color: DC.muted,
        marginTop: 12,
    },
    heroCard: {
        marginHorizontal: 16,
        marginBottom: 20,
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    heroGradient: {
        padding: 24,
        alignItems: 'center',
    },
    heroIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    heroLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: DC.muted,
        marginBottom: 4,
    },
    heroAmount: {
        fontSize: 36,
        fontWeight: '800',
        marginBottom: 4,
        letterSpacing: -0.8,
    },
    heroPeriod: {
        fontSize: 12,
        color: DC.muted,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#ffffff',
        padding: 14,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    statIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 2,
        letterSpacing: -0.3,
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
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: -0.3,
        color: DC.text,
    },
    trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    trendText: {
        fontSize: 11,
        fontWeight: '600',
    },
    chartCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        alignItems: 'center',
    },
    chart: {
        borderRadius: 16,
        marginLeft: -20,
    },
    transactionsSection: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    emptyTransactions: {
        backgroundColor: '#ffffff',
        padding: 40,
        borderRadius: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    emptyTransactionsText: {
        fontSize: 14,
        color: DC.muted,
        marginTop: 8,
    },
    transactionsList: {
        gap: 12,
    },
    transactionCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
        marginBottom: 12,
    },
    transactionCardLast: {
        marginBottom: 0,
    },
    transactionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    transactionIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
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
        marginBottom: 2,
    },
    transactionDate: {
        fontSize: 11,
        color: '#94a3b8',
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
        letterSpacing: -0.3,
    },
    transactionStatus: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
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