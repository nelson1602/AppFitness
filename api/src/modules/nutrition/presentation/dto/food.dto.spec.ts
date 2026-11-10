import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import {
  CreateCustomFoodDto,
  FoodSearchQueryDto,
  ImportFoodDto,
} from './food.dto';

function errors<T extends object>(cls: new () => T, plain: object): string[] {
  return validateSync(plainToInstance(cls, plain), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);
}

describe('food DTOs (ADR-P045)', () => {
  describe('FoodSearchQueryDto', () => {
    it('trims q and converts limit', () => {
      const dto = plainToInstance(FoodSearchQueryDto, {
        q: '  Chicharrón de cerdo ',
        limit: '20',
      });
      expect(dto.q).toBe('Chicharrón de cerdo');
      expect(dto.limit).toBe(20);
      expect(validateSync(dto)).toEqual([]);
    });

    it.each([
      [{ q: 'a' }, 'q'],
      [{ q: '  a  ' }, 'q'],
      [{ q: 'x'.repeat(81) }, 'q'],
      [{}, 'q'],
      [{ q: 'arroz', limit: '0' }, 'limit'],
      [{ q: 'arroz', limit: '21' }, 'limit'],
      [{ q: 'arroz', limit: '2.5' }, 'limit'],
    ])('rejects %p', (plain, property) => {
      expect(errors(FoodSearchQueryDto, plain)).toContain(property);
    });
  });

  describe('ImportFoodDto', () => {
    it('accepts a numeric id from fdc or off only', () => {
      expect(
        errors(ImportFoodDto, { source: 'off', sourceId: '7460000000017' }),
      ).toEqual([]);
      expect(
        errors(ImportFoodDto, { source: 'usda', sourceId: '1' }),
      ).toContain('source');
      expect(
        errors(ImportFoodDto, { source: 'fdc', sourceId: '1/../x' }),
      ).toContain('sourceId');
    });

    it('rejects client-sent macros', () => {
      expect(
        errors(ImportFoodDto, {
          source: 'fdc',
          sourceId: '168201',
          caloriesPerServing: 1,
        }),
      ).toContain('caloriesPerServing');
    });
  });

  describe('CreateCustomFoodDto', () => {
    const valid = {
      name: '  Chicharrón de cerdo  ',
      servingAmount: 1,
      servingUnit: 'serving',
      gramsPerServing: null,
      caloriesPerServing: 270,
      proteinPerServing: 30,
      carbsPerServing: 0,
      fatPerServing: 16,
    };

    it('accepts a valid food and trims the name', () => {
      const dto = plainToInstance(CreateCustomFoodDto, valid);
      expect(validateSync(dto)).toEqual([]);
      expect(dto.name).toBe('Chicharrón de cerdo');
    });

    it.each([
      [{ name: '   ' }, 'name'],
      [{ name: 'x'.repeat(81) }, 'name'],
      [{ name: 'a\u0000b' }, 'name'],
      [{ servingAmount: 0 }, 'servingAmount'],
      [{ servingUnit: 'kg' }, 'servingUnit'],
      [{ gramsPerServing: 0 }, 'gramsPerServing'],
      [{ caloriesPerServing: -1 }, 'caloriesPerServing'],
      [{ proteinPerServing: '30' }, 'proteinPerServing'],
      [{ fatPerServing: Number.NaN }, 'fatPerServing'],
      [{ createdBy: 'someone-else' }, 'createdBy'],
    ])('rejects %p', (patch, property) => {
      expect(errors(CreateCustomFoodDto, { ...valid, ...patch })).toContain(
        property,
      );
    });
  });
});
