import React, { useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { mistriDashboardColors } from '../lib/mistriDashboardTokens';

const CARD_SHADOW =
    '0 8px 24px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(15, 23, 42, 0.04)';

type Props = {
    chartWidth: number;
    available: number;
    active: number;
    completed: number;
    statusLabels: string[];
    statusData: number[];
    isLoading: boolean;
    accentHex: string;
    accentRgb: string;
};

export const MistriDashboardCharts = React.memo(function MistriDashboardCharts({
    chartWidth,
    available,
    active,
    completed,
    statusLabels,
    statusData,
    isLoading,
    accentHex,
    accentRgb,
}: Props) {
    const chartBg = mistriDashboardColors.cardFill;

    const chartConfig = useMemo(
        () => ({
            backgroundColor: chartBg,
            backgroundGradientFrom: chartBg,
            backgroundGradientTo: chartBg,
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(${accentRgb}, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(82, 82, 91, ${opacity})`,
            barPercentage: 0.55,
            barRadius: 4,
            propsForBackgroundLines: {
                stroke: '#e4e4e7',
                strokeWidth: 1,
                strokeDasharray: '0',
            },
            propsForLabels: {
                fontSize: 10,
            },
        }),
        [accentRgb, chartBg]
    );

    const workloadData = useMemo(
        () => ({
            labels: ['Open', 'Now', 'Done'],
            datasets: [{ data: [available, active, completed] }],
        }),
        [available, active, completed]
    );

    const statusChartData = useMemo(
        () => ({
            labels: statusLabels,
            datasets: [{ data: statusData.length ? statusData : [0] }],
        }),
        [statusLabels, statusData]
    );

    const hasStatusBreakdown = statusData.length > 0 && statusData.some((n) => n > 0);

    if (isLoading) {
        return (
            <View style={styles.card}>
                <Text style={styles.cardTitle} selectable>Overview</Text>
                <View style={styles.loadingBox}>
                    <ActivityIndicator color={accentHex} size="small" />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.column}>
            <View style={styles.card}>
                <Text style={styles.cardTitle} selectable>Workload</Text>
                <BarChart
                    data={workloadData}
                    width={chartWidth}
                    height={148}
                    yAxisLabel=""
                    yAxisSuffix=""
                    chartConfig={chartConfig}
                    style={styles.chart}
                    fromZero
                    withInnerLines={false}
                    showBarTops={false}
                    showValuesOnTopOfBars
                    flatColor
                />
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle} selectable>Active jobs</Text>
                {hasStatusBreakdown ? (
                    <BarChart
                        data={statusChartData}
                        width={chartWidth}
                        height={132}
                        yAxisLabel=""
                        yAxisSuffix=""
                        chartConfig={chartConfig}
                        style={styles.chart}
                        fromZero
                        withInnerLines={false}
                        showBarTops={false}
                        showValuesOnTopOfBars
                        flatColor
                    />
                ) : (
                    <Text style={styles.empty} selectable>
                        No active jobs — numbers will appear here when you accept work.
                    </Text>
                )}
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    column: {
        gap: 12,
    },
    card: {
        backgroundColor: mistriDashboardColors.cardFill,
        borderRadius: 16,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: mistriDashboardColors.cardBorder,
        paddingTop: 12,
        paddingBottom: 6,
        paddingHorizontal: 10,
        overflow: 'hidden',
        boxShadow: CARD_SHADOW,
    },
    cardTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#18181b',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginBottom: 4,
        marginLeft: 4,
    },
    chart: {
        marginLeft: -8,
        borderRadius: 12,
    },
    loadingBox: {
        paddingVertical: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    empty: {
        fontSize: 13,
        color: '#71717a',
        lineHeight: 18,
        paddingVertical: 20,
        paddingHorizontal: 8,
        textAlign: 'center',
    },
});
