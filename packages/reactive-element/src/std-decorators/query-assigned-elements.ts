/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

/*
 * IMPORTANT: For compatibility with tsickle and the Closure JS compiler, all
 * property decorators (but not class decorators) in this file that have
 * an @ExportDecoratedItems annotation must be defined as a regular function,
 * not an arrow function.
 */

import type {ReactiveElement} from '../reactive-element.js';
import type {QueryAssignedNodesOptions} from './query-assigned-nodes.js';

/**
 * Options for the {@linkcode queryAssignedElements} decorator. Extends the
 * options that can be passed into
 * [HTMLSlotElement.assignedElements](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSlotElement/assignedElements).
 */
export interface QueryAssignedElementsOptions
  extends QueryAssignedNodesOptions {
  /**
   * CSS selector used to filter the elements returned. For example, a selector
   * of `".item"` will only include elements with the `item` class.
   */
  selector?: string;
}

/**
 * An accessor decorator that converts a class property into a getter that
 * returns the `assignedElements` of the given `slot`. Provides a declarative
 * way to use
 * [`HTMLSlotElement.assignedElements`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSlotElement/assignedElements).
 *
 * Can be passed an optional {@linkcode QueryAssignedElementsOptions} object.
 *
 * Example usage:
 * ```ts
 * class MyElement {
 *   @queryAssignedElements({ slot: 'list' })
 *   listItems!: Array<HTMLElement>;
 *   @queryAssignedElements()
 *   unnamedSlotEls!: Array<HTMLElement>;
 *
 *   render() {
 *     return html`
 *       <slot name="list"></slot>
 *       <slot></slot>
 *     `;
 *   }
 * }
 * ```
 *
 * Note, the type of this property should be annotated as `Array<HTMLElement>`.
 *
 * @category Decorator
 */
export const queryAssignedElements =
  (options?: QueryAssignedElementsOptions) =>
  <C extends ReactiveElement, V extends ReadonlyArray<Element>>(
    _target: ClassAccessorDecoratorTarget<C, V>,
    _context: ClassAccessorDecoratorContext<C, V>
  ): ClassAccessorDecoratorResult<C, V> => {
    const {slot, selector} = options ?? {};
    return {
      get(this: C): V {
        const slotSelector = `slot${slot ? `[name=${slot}]` : ':not([name])'}`;
        const slotEl =
          this.renderRoot?.querySelector<HTMLSlotElement>(slotSelector);
        const elements = slotEl?.assignedElements(options) ?? [];
        if (selector) {
          // @ts-expect-error: argh!
          return elements.filter((node) => node.matches(selector));
        }
        // @ts-expect-error: argh!
        return elements;
      },
    };
  };
