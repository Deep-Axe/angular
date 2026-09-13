/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Component, model, signal, viewChild} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {form, FormField, transformedValue, type FormValueControl} from '../../public_api';

interface Row {
  id: string;
  score: number;
}

interface Model {
  rows: {id: string; points: number}[];
}

function parseRows(rows: Row[]): {value: Model} {
  return {value: {rows: rows.map((row) => ({id: row.id, points: row.score}))}};
}

function formatRows(modelValue: Model): Row[] {
  return modelValue.rows.map((row) => ({id: row.id, score: row.points}));
}

function equalRows(a: Row[], b: Row[]): boolean {
  return (
    a.length === b.length &&
    a.every((row, index) => row.id === b[index].id && row.score === b[index].score)
  );
}

function initialModel(): Model {
  return {
    rows: [
      {id: 'first', points: 10},
      {id: 'second', points: 20},
    ],
  };
}

@Component({
  selector: 'collection-control',
  template: `
    @for (rowField of rowsForm; track rowField) {
      <span>{{ rowField().value().id }}:{{ rowField().value().score }}</span>
    }
  `,
})
class CollectionControl implements FormValueControl<Model> {
  readonly value = model.required<Model>();

  readonly viewRows = transformedValue(this.value, {
    parse: parseRows,
    format: formatRows,
  });

  readonly rowsForm = form(this.viewRows);
}

@Component({
  selector: 'value-tracked-collection-control',
  template: `
    @for (rowField of rowsForm; track rowField().value().score) {
      <span>{{ rowField().value().score }}</span>
    }
  `,
})
class ValueTrackedCollectionControl implements FormValueControl<Model> {
  readonly value = model.required<Model>();

  readonly viewRows = transformedValue(this.value, {
    parse: parseRows,
    format: formatRows,
  });

  readonly rowsForm = form(this.viewRows);
}

@Component({
  selector: 'identity-preserving-collection-control',
  template: `
    @for (rowField of rowsForm; track rowField) {
      <span>{{ rowField().value().id }}:{{ rowField().value().score }}</span>
    }
  `,
})
class IdentityPreservingCollectionControl implements FormValueControl<Model> {
  readonly value = model.required<Model>();

  readonly viewRows = transformedValue(this.value, {
    parse: parseRows,
    format: formatRows,
    equal: equalRows,
  });

  readonly rowsForm = form(this.viewRows);
}

@Component({
  selector: 'value-tracked-identity-preserving-collection-control',
  template: `
    @for (rowField of rowsForm; track rowField().value().score) {
      <span>{{ rowField().value().score }}</span>
    }
  `,
})
class ValueTrackedIdentityPreservingCollectionControl implements FormValueControl<Model> {
  readonly value = model.required<Model>();

  readonly viewRows = transformedValue(this.value, {
    parse: parseRows,
    format: formatRows,
    equal: equalRows,
  });

  readonly rowsForm = form(this.viewRows);
}

@Component({
  imports: [CollectionControl, FormField],
  template: `<collection-control [formField]="planForm" />`,
})
class TestApp {
  readonly model = signal(initialModel());
  readonly planForm = form(this.model);
  readonly control = viewChild.required(CollectionControl);
}

@Component({
  imports: [ValueTrackedCollectionControl, FormField],
  template: `<value-tracked-collection-control [formField]="planForm" />`,
})
class ValueTrackedTestApp {
  readonly model = signal(initialModel());
  readonly planForm = form(this.model);
}

@Component({
  imports: [IdentityPreservingCollectionControl, FormField],
  template: `<identity-preserving-collection-control [formField]="planForm" />`,
})
class IdentityPreservingTestApp {
  readonly model = signal(initialModel());
  readonly planForm = form(this.model);
  readonly control = viewChild.required(IdentityPreservingCollectionControl);
}

@Component({
  imports: [ValueTrackedIdentityPreservingCollectionControl, FormField],
  template: `<value-tracked-identity-preserving-collection-control [formField]="planForm" />`,
})
class ValueTrackedIdentityPreservingTestApp {
  readonly model = signal(initialModel());
  readonly planForm = form(this.model);
  readonly control = viewChild.required(ValueTrackedIdentityPreservingCollectionControl);
}

describe('transformedValue', () => {
  it('keeps supported field tracking safe when a reset recreates collection fields', async () => {
    const fixture = TestBed.createComponent(TestApp);
    await fixture.whenStable();

    const control = fixture.componentInstance.control();
    const initialField = control.rowsForm[0];

    fixture.componentInstance.planForm().reset();
    await fixture.whenStable();

    expect(Object.is(control.rowsForm[0], initialField)).toBeFalse();
    expect(control.rowsForm[0]().value().score).toBe(10);
    expect(fixture.nativeElement.textContent).toContain('10');
    expect(fixture.nativeElement.textContent).toContain('20');
  });

  it('reports field tracking guidance for the original value-tracking expression', async () => {
    const fixture = TestBed.createComponent(ValueTrackedTestApp);
    await fixture.whenStable();

    fixture.componentInstance.planForm().reset();

    await expectAsync(fixture.whenStable()).toBeRejectedWithError(
      /NG01904: Orphan field.*track fields by identity.*`track field`/,
    );
  });

  it('preserves equal formatted collections and replaces them when their contents change', async () => {
    const fixture = TestBed.createComponent(IdentityPreservingTestApp);
    await fixture.whenStable();

    const control = fixture.componentInstance.control();
    const initialRows = control.viewRows();
    const initialField = control.rowsForm[0];
    expect(fixture.nativeElement.textContent).toContain('10');
    expect(fixture.nativeElement.textContent).toContain('20');

    fixture.componentInstance.planForm().reset();
    await fixture.whenStable();

    expect(control.viewRows()).toBe(initialRows);
    expect(control.rowsForm[0]).toBe(initialField);
    expect(control.rowsForm[0]().value().score).toBe(10);
    expect(fixture.nativeElement.textContent).toContain('10');
    expect(fixture.nativeElement.textContent).toContain('20');

    fixture.componentInstance.model.set({
      rows: [
        {id: 'first', points: 30},
        {id: 'second', points: 40},
      ],
    });
    await fixture.whenStable();

    expect(Object.is(control.viewRows(), initialRows)).toBeFalse();
    expect(Object.is(control.rowsForm[0], initialField)).toBeFalse();
    expect(control.rowsForm[0]().value().score).toBe(30);
    expect(fixture.nativeElement.textContent).toContain('30');
    expect(fixture.nativeElement.textContent).toContain('40');
  });

  it('does not retain collection fields across reorders or insertions', async () => {
    const fixture = TestBed.createComponent(IdentityPreservingTestApp);
    await fixture.whenStable();

    const control = fixture.componentInstance.control();
    const initialField = control.rowsForm[0];

    fixture.componentInstance.model.set({
      rows: [
        {id: 'second', points: 20},
        {id: 'first', points: 10},
      ],
    });
    await fixture.whenStable();

    expect(Object.is(control.rowsForm[0], initialField)).toBeFalse();
    expect(control.rowsForm[0]().value().id).toBe('second');

    const reorderedField = control.rowsForm[0];
    fixture.componentInstance.model.set({
      rows: [
        {id: 'new', points: 5},
        {id: 'second', points: 20},
        {id: 'first', points: 10},
      ],
    });
    await fixture.whenStable();

    expect(Object.is(control.rowsForm[0], reorderedField)).toBeFalse();
    expect(control.rowsForm[0]().value().id).toBe('new');
  });

  it('prevents the original value-tracking crash when reset formatting is equal', async () => {
    const fixture = TestBed.createComponent(ValueTrackedIdentityPreservingTestApp);
    await fixture.whenStable();

    const control = fixture.componentInstance.control();
    const initialField = control.rowsForm[0];

    fixture.componentInstance.planForm().reset();

    await expectAsync(fixture.whenStable()).toBeResolved();
    expect(control.rowsForm[0]).toBe(initialField);
  });
});
