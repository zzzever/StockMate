import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StockMetricsPanel, {
  peRiskLevel,
  peRiskLabel,
  turnoverActivity,
  amplitudeLevel,
  amplitudeLabel,
} from '@/components/StockMetricsPanel';
import type { StockFinance, PriceData } from '@/types';

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

function mockQuote(overrides?: Partial<PriceData>): PriceData {
  return {
    ticker: '000001',
    name: '平安银行',
    current_price: 12.5,
    open: 12.3,
    high: 12.8,
    low: 12.2,
    prev_close: 12.4,
    change: 0.1,
    change_percent: 0.81,
    volume: 50000000,
    amount: 625000000,
    ratio: 1.2,
    turnover_rate: 5.07,
    ...overrides,
  };
}

function mockFinance(overrides?: Partial<StockFinance>): Partial<StockFinance> {
  return {
    pe: 50.2,
    pb: 2.5,
    roe: 0.15,
    ...overrides,
  };
}

/* ═══════════════════════════════════════════════════════════
   Utility Function Tests
   ═══════════════════════════════════════════════════════════ */

describe('peRiskLevel', () => {
  it('returns normal for null/undefined/NaN', () => {
    expect(peRiskLevel(null)).toBe('normal');
    expect(peRiskLevel(undefined)).toBe('normal');
    expect(peRiskLevel(NaN)).toBe('normal');
  });

  it('returns danger for negative PE (loss-making)', () => {
    expect(peRiskLevel(-5)).toBe('danger');
    expect(peRiskLevel(-100)).toBe('danger');
  });

  it('returns safe for PE 0-15', () => {
    expect(peRiskLevel(0)).toBe('safe');
    expect(peRiskLevel(8)).toBe('safe');
    expect(peRiskLevel(15)).toBe('safe');
  });

  it('returns normal for PE 15-30', () => {
    expect(peRiskLevel(15.1)).toBe('normal');
    expect(peRiskLevel(20)).toBe('normal');
    expect(peRiskLevel(30)).toBe('normal');
  });

  it('returns warning for PE 30-60', () => {
    expect(peRiskLevel(30.1)).toBe('warning');
    expect(peRiskLevel(50.2)).toBe('warning');
    expect(peRiskLevel(60)).toBe('warning');
  });

  it('returns danger for PE > 60', () => {
    expect(peRiskLevel(60.1)).toBe('danger');
    expect(peRiskLevel(100)).toBe('danger');
    expect(peRiskLevel(500)).toBe('danger');
  });
});

describe('peRiskLabel', () => {
  it('returns empty for null/undefined/NaN', () => {
    expect(peRiskLabel(null)).toBe('');
    expect(peRiskLabel(undefined)).toBe('');
  });

  it('returns 亏损 for negative PE', () => {
    expect(peRiskLabel(-5)).toBe('亏损');
  });

  it('returns 低估 for PE 0-15', () => {
    expect(peRiskLabel(8)).toBe('低估');
  });

  it('returns 合理 for PE 15-30', () => {
    expect(peRiskLabel(20)).toBe('合理');
  });

  it('returns 偏高 for PE 30-60', () => {
    expect(peRiskLabel(50.2)).toBe('偏高');
  });

  it('returns 极高 for PE > 60', () => {
    expect(peRiskLabel(80)).toBe('极高');
    expect(peRiskLabel(150)).toBe('极高');
  });

  it('boundary: PE=0 → 低估', () => {
    expect(peRiskLabel(0)).toBe('低估');
  });

  it('boundary: PE=15 → 低估', () => {
    expect(peRiskLabel(15)).toBe('低估');
  });

  it('boundary: PE=30 → 合理', () => {
    expect(peRiskLabel(30)).toBe('合理');
  });

  it('boundary: PE=61 → 极高', () => {
    expect(peRiskLabel(61)).toBe('极高');
  });

  it('returns 偏高 for PE exactly at 60', () => {
    expect(peRiskLabel(60)).toBe('偏高');
  });
});

describe('turnoverActivity', () => {
  it('returns default for null/undefined/NaN', () => {
    const r = turnoverActivity(null);
    expect(r.level).toBe('normal');
    expect(r.label).toBe('--');
    expect(r.segments).toBe(0);
  });

  it('returns 低迷/0 segments for rate < 1', () => {
    const r = turnoverActivity(0.5);
    expect(r.level).toBe('safe');
    expect(r.label).toBe('低迷');
    expect(r.segments).toBe(0);
  });

  it('returns 正常/1 segment for rate 1-3', () => {
    const r = turnoverActivity(2);
    expect(r.level).toBe('normal');
    expect(r.label).toBe('正常');
    expect(r.segments).toBe(1);
  });

  it('returns 活跃/2 segments for rate 3-7', () => {
    const r = turnoverActivity(5.07);
    expect(r.level).toBe('warning');
    expect(r.label).toBe('活跃');
    expect(r.segments).toBe(2);
  });

  it('returns 极高/3 segments for rate > 7', () => {
    const r = turnoverActivity(12);
    expect(r.level).toBe('danger');
    expect(r.label).toBe('极高');
    expect(r.segments).toBe(3);
  });

  it('boundary: exactly 1 → normal', () => {
    expect(turnoverActivity(1).label).toBe('正常');
  });

  it('boundary: exactly 3 → warning', () => {
    expect(turnoverActivity(3).label).toBe('活跃');
  });

  it('boundary: exactly 7 → danger', () => {
    expect(turnoverActivity(7).label).toBe('极高');
  });
});

describe('amplitudeLevel', () => {
  it('returns normal for null/undefined/NaN', () => {
    expect(amplitudeLevel(null)).toBe('normal');
    expect(amplitudeLevel(undefined)).toBe('normal');
  });

  it('returns safe for amp < 2', () => {
    expect(amplitudeLevel(1.5)).toBe('safe');
  });

  it('returns normal for amp 2-5', () => {
    expect(amplitudeLevel(3)).toBe('normal');
    expect(amplitudeLevel(4.05)).toBe('normal');
  });

  it('returns warning for amp 5-8', () => {
    expect(amplitudeLevel(6)).toBe('warning');
  });

  it('returns danger for amp > 8', () => {
    expect(amplitudeLevel(10)).toBe('danger');
    expect(amplitudeLevel(15)).toBe('danger');
  });

  it('boundary: exactly 2 → normal', () => {
    expect(amplitudeLevel(2)).toBe('normal');
  });

  it('boundary: exactly 5 → warning', () => {
    expect(amplitudeLevel(5)).toBe('warning');
  });

  it('boundary: exactly 8 → danger', () => {
    expect(amplitudeLevel(8)).toBe('danger');
  });
});

describe('amplitudeLabel', () => {
  it('returns empty for null', () => {
    expect(amplitudeLabel(null)).toBe('');
  });

  it('returns 窄幅 for amp < 2', () => {
    expect(amplitudeLabel(1)).toBe('窄幅');
  });

  it('returns 正常 for amp 2-5', () => {
    expect(amplitudeLabel(3)).toBe('正常');
  });

  it('returns 波动 for amp 5-8', () => {
    expect(amplitudeLabel(6)).toBe('波动');
  });

  it('returns 剧烈 for amp > 8', () => {
    expect(amplitudeLabel(10)).toBe('剧烈');
  });

  it('boundary: exactly 2 → 正常', () => {
    expect(amplitudeLabel(2)).toBe('正常');
  });

  it('boundary: exactly 5 → 波动', () => {
    expect(amplitudeLabel(5)).toBe('波动');
  });

  it('boundary: exactly 8 → 剧烈', () => {
    expect(amplitudeLabel(8)).toBe('剧烈');
  });
});

/* ═══════════════════════════════════════════════════════════
   Component Tests
   ═══════════════════════════════════════════════════════════ */

describe('StockMetricsPanel', () => {
  it('renders all core metrics with compact labels', () => {
    render(
      <StockMetricsPanel
        finance={mockFinance()}
        realtimeQuote={mockQuote()}
        mainFlow={160000000}
        prevClose={12.4}
      />,
    );

    // Compact labels (abbreviated for space)
    expect(screen.getByText('成交额')).toBeInTheDocument();
    expect(screen.getByText('主力')).toBeInTheDocument();
    expect(screen.getByText('PE')).toBeInTheDocument();
    expect(screen.getByText('换手')).toBeInTheDocument();
    expect(screen.getByText('振幅')).toBeInTheDocument();

    // Values present
    expect(screen.getByText('50.2')).toBeInTheDocument();
    expect(screen.getByText('5.07%')).toBeInTheDocument();
    expect(screen.getByText('+1.6亿')).toBeInTheDocument();
  });

  it('renders support/resistance when provided', () => {
    render(
      <StockMetricsPanel
        finance={mockFinance()}
        realtimeQuote={mockQuote()}
        mainFlow={0}
        supportResistance={{ stock_id: '000001', supports: [12.0], resistances: [13.5], nearest_support: 12.0, nearest_resistance: 13.5 }}
      />,
    );

    expect(screen.getByText('阻力')).toBeInTheDocument();
    expect(screen.getByText('支撑')).toBeInTheDocument();
  });

  it('shows risk dot for elevated PE (not text badge)', () => {
    const { container } = render(
      <StockMetricsPanel
        finance={mockFinance({ pe: 55 })}
        realtimeQuote={mockQuote()}
        mainFlow={0}
      />,
    );

    // No text badge in compact mode — risk dot is rendered as inline-block span
    expect(screen.queryByText('偏高')).not.toBeInTheDocument();
    // PE value still shown
    expect(screen.getByText('55.0')).toBeInTheDocument();
    // Risk dot rendered with risk-warning color
    const dots = container.querySelectorAll('[style*="risk-warning"]');
    expect(dots.length).toBeGreaterThan(0);
  });

  it('shows risk dot for danger PE', () => {
    const { container } = render(
      <StockMetricsPanel
        finance={mockFinance({ pe: 80 })}
        realtimeQuote={mockQuote()}
        mainFlow={0}
      />,
    );

    expect(screen.getByText('80.0')).toBeInTheDocument();
    const dots = container.querySelectorAll('[style*="risk-danger"]');
    expect(dots.length).toBeGreaterThan(0);
  });

  it('shows risk dot for negative PE (亏损)', () => {
    const { container } = render(
      <StockMetricsPanel
        finance={mockFinance({ pe: -10 })}
        realtimeQuote={mockQuote()}
        mainFlow={0}
      />,
    );

    expect(screen.getByText('-10.0')).toBeInTheDocument();
    // Risk dot in danger color
    const dots = container.querySelectorAll('[style*="risk-danger"]');
    expect(dots.length).toBeGreaterThan(0);
  });

  it('shows activity dots for turnover rate > 3%', () => {
    const { container } = render(
      <StockMetricsPanel
        finance={mockFinance()}
        realtimeQuote={mockQuote({ turnover_rate: 5.07 })}
        mainFlow={0}
      />,
    );

    // No text badge
    expect(screen.queryByText('活跃')).not.toBeInTheDocument();
    // Activity dots present (amber filled circles)
    const amberDots = container.querySelectorAll('[style*="risk-warning"][style*="border-radius: 50%"]');
    expect(amberDots.length).toBeGreaterThan(0);
  });

  it('shows -- for PE when finance data missing', () => {
    render(
      <StockMetricsPanel
        finance={null}
        realtimeQuote={mockQuote()}
        mainFlow={0}
      />,
    );

    expect(screen.getByText('PE')).toBeInTheDocument();
    // Multiple -- values (PE, mainFlow, amplitude)
    const dashes = screen.getAllByText('--');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('shows positive main flow with + sign', () => {
    render(
      <StockMetricsPanel
        finance={mockFinance()}
        realtimeQuote={mockQuote()}
        mainFlow={160000000}
      />,
    );

    expect(screen.getByText('+1.6亿')).toBeInTheDocument();
  });

  it('shows negative main flow with - sign', () => {
    render(
      <StockMetricsPanel
        finance={mockFinance()}
        realtimeQuote={mockQuote()}
        mainFlow={-50000000}
      />,
    );

    expect(screen.getByText(/-5000\.0万/)).toBeInTheDocument();
  });

  it('shows warning text when multiple risks present', () => {
    render(
      <StockMetricsPanel
        finance={mockFinance({ pe: 55 })}
        realtimeQuote={mockQuote({ turnover_rate: 5.07 })}
        mainFlow={0}
        prevClose={12.4}
      />,
    );

    // Risk summary text in strip — both PE and turnover warnings
    expect(screen.getByText(/市盈率偏高/)).toBeInTheDocument();
    expect(screen.getByText(/换手率活跃/)).toBeInTheDocument();
  });

  it('shows critical warning (⚠) when PE danger + turnover danger', () => {
    render(
      <StockMetricsPanel
        finance={mockFinance({ pe: 80 })}
        realtimeQuote={mockQuote({ turnover_rate: 8 })}
        mainFlow={0}
        prevClose={12.4}
      />,
    );

    expect(screen.getByText(/⚠/)).toBeInTheDocument();
  });

  it('shows flow arrow for positive inflow', () => {
    const { container } = render(
      <StockMetricsPanel
        finance={mockFinance()}
        realtimeQuote={mockQuote()}
        mainFlow={160000000}
      />,
    );

    expect(container.textContent).toContain('↗');
  });

  it('shows flow arrow for negative outflow', () => {
    const { container } = render(
      <StockMetricsPanel
        finance={mockFinance()}
        realtimeQuote={mockQuote()}
        mainFlow={-50000000}
      />,
    );

    expect(container.textContent).toContain('↘');
  });

  it('shows -- for all metrics when no data', () => {
    render(<StockMetricsPanel />);

    // All values should be --
    const dashes = screen.getAllByText('--');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it('shows -- for PE when finance data missing', () => {
    render(
      <StockMetricsPanel
        finance={null}
        realtimeQuote={mockQuote()}
        mainFlow={0}
      />,
    );

    // PE label still rendered, value is "--"
    expect(screen.getByText('PE')).toBeInTheDocument();
    const dashes = screen.getAllByText('--');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('handles missing realtime quote gracefully', () => {
    render(
      <StockMetricsPanel
        finance={mockFinance()}
        realtimeQuote={null}
        mainFlow={0}
      />,
    );

    // Should still render PE from finance
    expect(screen.getByText('50.2')).toBeInTheDocument();
    // Turnover/amount/amp should all be --
    const dashes = screen.getAllByText('--');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it('does not show PB, ROE, or 量比 when invalid', () => {
    render(
      <StockMetricsPanel
        finance={mockFinance({ pb: 0, roe: undefined })}
        realtimeQuote={mockQuote({ ratio: 0 })}
        mainFlow={0}
      />,
    );

    expect(screen.queryByText('市净率')).not.toBeInTheDocument();
    expect(screen.queryByText('ROE')).not.toBeInTheDocument();
    expect(screen.queryByText('量比')).not.toBeInTheDocument();
  });

  it('shows amplitude with correct formula: (high-low)/prevClose * 100', () => {
    render(
      <StockMetricsPanel
        finance={mockFinance()}
        realtimeQuote={mockQuote({ high: 12.8, low: 12.2 })}
        prevClose={12.4}
        mainFlow={0}
      />,
    );

    // (12.8 - 12.2) / 12.4 * 100 = 4.84%
    expect(screen.getByText('4.84%')).toBeInTheDocument();
  });

  it('does not show warning row when all metrics normal', () => {
    render(
      <StockMetricsPanel
        finance={mockFinance({ pe: 20 })}
        realtimeQuote={mockQuote({ turnover_rate: 1.5 })}
        mainFlow={0}
        prevClose={12.4}
      />,
    );

    // No risk badges should render
    expect(screen.queryByText('偏高')).not.toBeInTheDocument();
    expect(screen.queryByText('活跃')).not.toBeInTheDocument();
  });

  it('shows critical warning (⚠) when PE danger + turnover danger', () => {
    render(
      <StockMetricsPanel
        finance={mockFinance({ pe: 80 })}
        realtimeQuote={mockQuote({ turnover_rate: 8 })}
        mainFlow={0}
        prevClose={12.4}
      />,
    );

    expect(screen.getByText(/⚠/)).toBeInTheDocument();
  });

  it('formats turnover rate with 2 decimal places', () => {
    render(
      <StockMetricsPanel
        finance={mockFinance()}
        realtimeQuote={mockQuote({ turnover_rate: 3.456 })}
        mainFlow={0}
      />,
    );

    expect(screen.getByText('3.46%')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <StockMetricsPanel
        finance={mockFinance()}
        realtimeQuote={mockQuote()}
        className="custom-test"
      />,
    );

    expect(container.querySelector('.custom-test')).toBeInTheDocument();
  });

  it('shows -- for amplitude when prevClose is 0 (division by zero guard)', () => {
    render(
      <StockMetricsPanel
        finance={mockFinance()}
        realtimeQuote={mockQuote({ high: 12.8, low: 12.2 })}
        prevClose={0}
        mainFlow={0}
      />,
    );

    // Amplitude should be '--' because prevClose=0
    // Find "--" in the amplitude column or just verify it doesn't render a computed %
    expect(screen.queryByText(/4\.84%/)).not.toBeInTheDocument();
  });

  it('mainFlow with large positive value formats as 亿', () => {
    render(
      <StockMetricsPanel
        finance={mockFinance()}
        realtimeQuote={mockQuote()}
        mainFlow={500000000}
      />,
    );

    expect(screen.getByText(/\+5\.0亿/)).toBeInTheDocument();
  });

  it('mainFlow with small value uses raw number', () => {
    render(
      <StockMetricsPanel
        finance={mockFinance()}
        realtimeQuote={mockQuote()}
        mainFlow={500}
      />,
    );

    expect(screen.getByText('+500')).toBeInTheDocument();
  });

  it('PE=100 shows risk-danger dot', () => {
    const { container } = render(
      <StockMetricsPanel
        finance={mockFinance({ pe: 100 })}
        realtimeQuote={mockQuote()}
        mainFlow={0}
      />,
    );

    expect(screen.getByText('100.0')).toBeInTheDocument();
    const dots = container.querySelectorAll('[style*="risk-danger"]');
    expect(dots.length).toBeGreaterThan(0);
  });

  it('PE=0 shows risk-safe dot', () => {
    const { container } = render(
      <StockMetricsPanel
        finance={mockFinance({ pe: 0 })}
        realtimeQuote={mockQuote()}
        mainFlow={0}
      />,
    );

    expect(screen.getByText('0.0')).toBeInTheDocument();
    const dots = container.querySelectorAll('[style*="risk-safe"]');
    expect(dots.length).toBeGreaterThan(0);
  });
});
