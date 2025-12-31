/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import {
	aktToUakt,
	uaktToAkt,
	parseMemorySize,
	parseCpuUnits,
	formatBytes,
	formatCoin,
	parseAmountString,
	calculateTotalCost,
	compareAmounts,
	addAmounts,
	subtractAmounts,
} from '../../nodes/Akash/helpers/amountConverter';

describe('Amount Converter', () => {
	describe('aktToUakt', () => {
		it('should convert whole AKT to uAKT', () => {
			expect(aktToUakt('1')).toBe('1000000');
			expect(aktToUakt('10')).toBe('10000000');
			expect(aktToUakt('100')).toBe('100000000');
		});

		it('should convert fractional AKT to uAKT', () => {
			expect(aktToUakt('0.5')).toBe('500000');
			expect(aktToUakt('1.5')).toBe('1500000');
			expect(aktToUakt('0.000001')).toBe('1');
		});

		it('should handle zero', () => {
			expect(aktToUakt('0')).toBe('0');
		});

		it('should handle large numbers', () => {
			expect(aktToUakt('1000000')).toBe('1000000000000');
		});
	});

	describe('uaktToAkt', () => {
		it('should convert uAKT to AKT', () => {
			expect(uaktToAkt('1000000')).toBe('1.000000');
			expect(uaktToAkt('10000000')).toBe('10.000000');
			expect(uaktToAkt('500000')).toBe('0.500000');
		});

		it('should handle small amounts', () => {
			expect(uaktToAkt('1')).toBe('0.000001');
			expect(uaktToAkt('100')).toBe('0.000100');
		});

		it('should handle zero', () => {
			expect(uaktToAkt('0')).toBe('0.000000');
		});
	});

	describe('parseMemorySize', () => {
		it('should parse Mi units', () => {
			expect(parseMemorySize('512Mi')).toBe(536870912);
			expect(parseMemorySize('1024Mi')).toBe(1073741824);
		});

		it('should parse Gi units', () => {
			expect(parseMemorySize('1Gi')).toBe(1073741824);
			expect(parseMemorySize('2Gi')).toBe(2147483648);
		});

		it('should parse Ki units', () => {
			expect(parseMemorySize('1024Ki')).toBe(1048576);
		});

		it('should parse raw bytes', () => {
			expect(parseMemorySize('1000000')).toBe(1000000);
		});
	});

	describe('parseCpuUnits', () => {
		it('should parse decimal CPU units', () => {
			expect(parseCpuUnits('0.5')).toBe(0.5);
			expect(parseCpuUnits('1')).toBe(1);
			expect(parseCpuUnits('2.5')).toBe(2.5);
		});

		it('should parse millicores', () => {
			expect(parseCpuUnits('500m')).toBe(0.5);
			expect(parseCpuUnits('1000m')).toBe(1);
		});
	});

	describe('formatBytes', () => {
		it('should format bytes to human readable with binary units', () => {
			expect(formatBytes(1024)).toBe('1.00 Ki');
			expect(formatBytes(1048576)).toBe('1.00 Mi');
			expect(formatBytes(1073741824)).toBe('1.00 Gi');
		});

		it('should handle zero', () => {
			expect(formatBytes(0)).toBe('0 B');
		});
	});

	describe('formatCoin', () => {
		it('should format uakt to AKT display', () => {
			expect(formatCoin({ amount: '1000000', denom: 'uakt' })).toBe('1.000000 AKT');
			expect(formatCoin({ amount: '500000', denom: 'uakt' })).toBe('0.500000 AKT');
		});

		it('should handle unknown denominations', () => {
			expect(formatCoin({ amount: '100', denom: 'unknown' })).toBe('100 unknown');
		});
	});

	describe('parseAmountString', () => {
		it('should parse amount strings', () => {
			expect(parseAmountString('1000000uakt')).toEqual({
				amount: '1000000',
				denom: 'uakt',
			});
		});

		it('should handle amounts with spaces', () => {
			expect(parseAmountString('1000000 uakt')).toEqual({
				amount: '1000000',
				denom: 'uakt',
			});
		});
	});

	describe('calculateTotalCost', () => {
		it('should calculate total cost', () => {
			expect(calculateTotalCost('100', 1000)).toBe('100000');
			expect(calculateTotalCost('50', 500)).toBe('25000');
		});
	});

	describe('compareAmounts', () => {
		it('should compare amounts correctly', () => {
			expect(compareAmounts('1000', '500')).toBe(1);
			expect(compareAmounts('500', '1000')).toBe(-1);
			expect(compareAmounts('500', '500')).toBe(0);
		});
	});

	describe('addAmounts', () => {
		it('should add amounts', () => {
			expect(addAmounts('1000', '500')).toBe('1500');
			expect(addAmounts('0', '500')).toBe('500');
		});
	});

	describe('subtractAmounts', () => {
		it('should subtract amounts', () => {
			expect(subtractAmounts('1000', '500')).toBe('500');
		});

		it('should throw error for negative result', () => {
			expect(() => subtractAmounts('500', '1000')).toThrow('Subtraction would result in negative amount');
		});
	});
});
