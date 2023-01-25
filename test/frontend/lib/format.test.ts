import FormatLib from 'lib/format';
import { IFablab } from 'models/fablab';

declare const Fablab: IFablab;
describe('FormatLib', () => {
  test('format a date', () => {
    Fablab.intl_locale = 'fr-FR';
    const str = FormatLib.date(new Date('2023-01-12T12:00:00+0100'));
    expect(str).toBe('12/01/2023');
  });
  test('format an iso8601 short date', () => {
    Fablab.intl_locale = 'fr-FR';
    const str = FormatLib.date('2023-01-12');
    expect(str).toBe('12/01/2023');
  });
  test('format an iso8601 date', () => {
    Fablab.intl_locale = 'fr-CA';
    const str = FormatLib.date('2023-01-12T23:59:14-0500');
    expect(str).toBe('2023-01-12');
  });
  test('format a time', () => {
    Fablab.intl_locale = 'fr-FR';
    const str = FormatLib.time(new Date('2023-01-12T23:59:14+0100'));
    expect(str).toBe('23:59');
  });
  test('format an iso8601 short time', () => {
    Fablab.intl_locale = 'fr-FR';
    const str = FormatLib.time('23:59');
    expect(str).toBe('23:59');
  });
  test('format an iso8601 time', () => {
    Fablab.intl_locale = 'fr-CA';
    const str = FormatLib.time('2023-01-12T23:59:14-0500');
    expect(str).toBe('23 h 59');
  });
});