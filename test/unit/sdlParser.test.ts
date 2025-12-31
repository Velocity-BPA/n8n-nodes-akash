/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import {
	parseSDL,
	validateSDL,
	generateVersionHash,
	createSimpleSDL,
	calculateSDLPrice,
} from '../../nodes/Akash/helpers/sdlParser';

const VALID_SDL = `
version: "2.0"
services:
  web:
    image: nginx:latest
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          - size: 1Gi
  placement:
    dcloud:
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  dcloud:
    web:
      profile: web
      count: 1
`;

const MULTI_SERVICE_SDL = `
version: "2.0"
services:
  web:
    image: nginx:latest
    expose:
      - port: 80
        as: 80
        to:
          - global: true
  api:
    image: node:18
    expose:
      - port: 3000
        as: 3000
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          - size: 1Gi
    api:
      resources:
        cpu:
          units: 1
        memory:
          size: 1Gi
        storage:
          - size: 2Gi
  placement:
    dcloud:
      pricing:
        web:
          denom: uakt
          amount: 1000
        api:
          denom: uakt
          amount: 2000
deployment:
  dcloud:
    web:
      profile: web
      count: 1
    api:
      profile: api
      count: 1
`;

describe('SDL Parser', () => {
	describe('parseSDL', () => {
		it('should parse valid SDL', () => {
			const parsed = parseSDL(VALID_SDL);

			expect(parsed).toBeDefined();
			expect(parsed.version).toBe('2.0');
			expect(parsed.services).toBeDefined();
			expect(parsed.services.web).toBeDefined();
		});

		it('should throw on invalid YAML', () => {
			expect(() => parseSDL('invalid: yaml: structure:')).toThrow();
		});

		it('should parse services with expose configuration', () => {
			const parsed = parseSDL(VALID_SDL);
			const webService = parsed.services.web;

			expect(webService.image).toBe('nginx:latest');
			expect(webService.expose).toBeDefined();
			expect(webService.expose![0].port).toBe(80);
		});

		it('should parse profiles', () => {
			const parsed = parseSDL(VALID_SDL);

			expect(parsed.profiles).toBeDefined();
			expect(parsed.profiles.compute).toBeDefined();
			expect(parsed.profiles.placement).toBeDefined();
		});

		it('should parse placement pricing', () => {
			const parsed = parseSDL(VALID_SDL);
			const pricing = parsed.profiles.placement.dcloud.pricing.web;

			expect(pricing).toBeDefined();
			expect(pricing.denom).toBe('uakt');
			expect(pricing.amount).toBe(1000);
		});

		it('should parse deployment configuration', () => {
			const parsed = parseSDL(VALID_SDL);

			expect(parsed.deployment).toBeDefined();
			expect(parsed.deployment.dcloud).toBeDefined();
			expect(parsed.deployment.dcloud.web.count).toBe(1);
		});
	});

	describe('validateSDL', () => {
		it('should validate valid SDL', () => {
			const parsed = parseSDL(VALID_SDL);
			const result = validateSDL(parsed);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should fail validation for missing services', () => {
			const invalidSdl = {
				version: '2.0',
				services: {},
				profiles: {
					compute: {},
					placement: {},
				},
				deployment: {},
			};

			const result = validateSDL(invalidSdl as any);

			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should fail validation for missing version', () => {
			const invalidSdl = {
				services: {
					web: { image: 'nginx:latest' },
				},
			};

			const result = validateSDL(invalidSdl as any);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Missing required field: version');
		});
	});

	describe('generateVersionHash', () => {
		it('should generate consistent hash for same SDL', () => {
			const parsed = parseSDL(VALID_SDL);
			const hash1 = generateVersionHash(parsed);
			const hash2 = generateVersionHash(parsed);

			// Uint8Arrays need to be compared by content
			expect(Array.from(hash1)).toEqual(Array.from(hash2));
		});

		it('should generate different hashes for different SDLs', () => {
			const parsed1 = parseSDL(VALID_SDL);
			const parsed2 = parseSDL(MULTI_SERVICE_SDL);
			const hash1 = generateVersionHash(parsed1);
			const hash2 = generateVersionHash(parsed2);

			expect(Array.from(hash1)).not.toEqual(Array.from(hash2));
		});
	});

	describe('createSimpleSDL', () => {
		it('should create valid SDL string for simple service', () => {
			const sdlString = createSimpleSDL({
				serviceName: 'web',
				image: 'nginx:latest',
				cpu: 0.5,
				memory: '512Mi',
				storage: '1Gi',
				port: 80,
			});

			expect(sdlString).toBeDefined();
			expect(typeof sdlString).toBe('string');

			// Parse the created SDL to verify it's valid
			const parsed = parseSDL(sdlString);
			expect(parsed.version).toBe('2.0');
			expect(parsed.services.web.image).toBe('nginx:latest');
		});

		it('should include port expose when specified', () => {
			const sdlString = createSimpleSDL({
				serviceName: 'api',
				image: 'node:18',
				cpu: 1,
				memory: '1Gi',
				storage: '2Gi',
				port: 3000,
			});

			const parsed = parseSDL(sdlString);
			expect(parsed.services.api.expose).toBeDefined();
			expect(parsed.services.api.expose![0].port).toBe(3000);
		});
	});

	describe('calculateSDLPrice', () => {
		it('should calculate price from SDL', () => {
			const parsed = parseSDL(VALID_SDL);
			const price = calculateSDLPrice(parsed);

			// Returns ICoin object
			expect(price).toBeDefined();
			expect(price.denom).toBe('uakt');
			// 1000 AKT * 1000000 (uakt per akt) = 1000000000 uakt
			expect(price.amount).toBe('1000000000');
		});

		it('should sum prices for multiple services', () => {
			const parsed = parseSDL(MULTI_SERVICE_SDL);
			const price = calculateSDLPrice(parsed);

			expect(price.denom).toBe('uakt');
			// (1000 + 2000) AKT * 1000000 = 3000000000 uakt
			expect(price.amount).toBe('3000000000');
		});
	});
});
