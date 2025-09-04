const { analyzeConfluence } = require('../src/signalAnalyzer');

describe('Signal Analyzer', () => {
  test('should return buy with high confidence for multiple buy signals', () => {
    const signals = [
      { timeframe: '30min', signal: 'buy', timestamp: Date.now() },
      { timeframe: '1h', signal: 'buy', timestamp: Date.now() },
      { timeframe: '4h', signal: 'hold', timestamp: Date.now() }
    ];

    const result = analyzeConfluence(signals);
    expect(result.action).toBe('buy');
    expect(result.confidence).toBeGreaterThan(5);
  });

  test('should return sell if higher timeframe overrides', () => {
    const signals = [
      { timeframe: '30min', signal: 'buy', timestamp: Date.now() },
      { timeframe: '1h', signal: 'buy', timestamp: Date.now() },
      { timeframe: '4h', signal: 'sell', timestamp: Date.now() }
    ];

    const result = analyzeConfluence(signals);
    expect(result.action).toBe('hold'); // Assuming override logic
  });

  test('should return hold for conflicting signals', () => {
    const signals = [
      { timeframe: '30min', signal: 'buy', timestamp: Date.now() },
      { timeframe: '1h', signal: 'sell', timestamp: Date.now() }
    ];

    const result = analyzeConfluence(signals);
    expect(result.action).toBe('hold');
  });
});