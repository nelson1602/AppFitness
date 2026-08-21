import {
  FAIL_CLOSED_TRACKER_KEY,
  isRailwayRuntime,
  resolveTrackerKey,
  type TrackerRequest,
} from './throttler.config';

describe('resolveTrackerKey (ADR-P020 C-1A Railway-aware tracker)', () => {
  const xff = (v: string | string[] | undefined): TrackerRequest => ({
    ip: '10.9.9.9',
    headers: { 'x-forwarded-for': v },
  });

  describe('Railway mode', () => {
    it('uses the first/left-most XFF entry for IPv4', () => {
      expect(resolveTrackerKey(xff('203.0.113.7'), true)).toBe('203.0.113.7');
    });

    it('uses the first/left-most XFF entry for IPv6', () => {
      expect(resolveTrackerKey(xff('2001:db8::1'), true)).toBe('2001:db8::1');
    });

    it('selects the left-most client across varying trailing proxy hops', () => {
      const a = resolveTrackerKey(
        xff('203.0.113.7, 10.0.0.1, 172.16.0.9'),
        true,
      );
      const b = resolveTrackerKey(
        xff('203.0.113.7, 10.0.0.2, 172.16.1.4'),
        true,
      );
      expect(a).toBe('203.0.113.7');
      expect(b).toBe('203.0.113.7');
      expect(a).toBe(b); // same client → same bucket regardless of trailing hops
    });

    it('normalizes surrounding whitespace on the first entry', () => {
      expect(resolveTrackerKey(xff('  203.0.113.7 , 10.0.0.1'), true)).toBe(
        '203.0.113.7',
      );
    });

    it('fails closed to one shared key when XFF is missing', () => {
      expect(resolveTrackerKey({ ip: '10.9.9.9', headers: {} }, true)).toBe(
        FAIL_CLOSED_TRACKER_KEY,
      );
    });

    it('fails closed when XFF is empty', () => {
      expect(resolveTrackerKey(xff(''), true)).toBe(FAIL_CLOSED_TRACKER_KEY);
    });

    it('fails closed when XFF is array-valued (multiple headers)', () => {
      expect(resolveTrackerKey(xff(['203.0.113.7', '203.0.113.8']), true)).toBe(
        FAIL_CLOSED_TRACKER_KEY,
      );
    });

    it('fails closed when the first entry is not a valid IP', () => {
      expect(resolveTrackerKey(xff('not-an-ip, 203.0.113.7'), true)).toBe(
        FAIL_CLOSED_TRACKER_KEY,
      );
      expect(resolveTrackerKey(xff('999.999.999.999'), true)).toBe(
        FAIL_CLOSED_TRACKER_KEY,
      );
    });

    it('all fail-closed inputs map to the SAME deterministic key', () => {
      const keys = [
        resolveTrackerKey({ headers: {} }, true),
        resolveTrackerKey(xff(''), true),
        resolveTrackerKey(xff(['a', 'b']), true),
        resolveTrackerKey(xff('garbage'), true),
      ];
      expect(new Set(keys).size).toBe(1);
      expect(keys[0]).toBe(FAIL_CLOSED_TRACKER_KEY);
    });

    it('never falls back to a varying proxy/req.ip address on invalid XFF', () => {
      const key = resolveTrackerKey(
        { ip: '198.51.100.55', headers: { 'x-forwarded-for': 'garbage' } },
        true,
      );
      expect(key).not.toBe('198.51.100.55');
      expect(key).toBe(FAIL_CLOSED_TRACKER_KEY);
    });
  });

  describe('non-Railway mode', () => {
    it('uses req.ip', () => {
      expect(resolveTrackerKey({ ip: '198.51.100.10' }, false)).toBe(
        '198.51.100.10',
      );
    });

    it('ignores client-supplied XFF as a direct source', () => {
      expect(
        resolveTrackerKey(
          {
            ip: '198.51.100.10',
            headers: { 'x-forwarded-for': '203.0.113.7' },
          },
          false,
        ),
      ).toBe('198.51.100.10'); // req.ip wins, spoofed XFF ignored
    });

    it('fails closed when req.ip is absent', () => {
      expect(resolveTrackerKey({ headers: {} }, false)).toBe(
        FAIL_CLOSED_TRACKER_KEY,
      );
    });
  });
});

describe('isRailwayRuntime', () => {
  it('true when RAILWAY_ENVIRONMENT_ID is a non-empty string', () => {
    expect(isRailwayRuntime({ RAILWAY_ENVIRONMENT_ID: 'env-123' })).toBe(true);
  });

  it('false when the marker is absent or empty', () => {
    expect(isRailwayRuntime({})).toBe(false);
    expect(isRailwayRuntime({ RAILWAY_ENVIRONMENT_ID: '' })).toBe(false);
  });
});
