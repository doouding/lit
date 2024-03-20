/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {ReactiveElement} from '@lit/reactive-element';
import {Connector, type ConnectorOptions} from './connector.js';
import type {Store} from '@reduxjs/toolkit';

export function select<S extends Store, V>(
  selector: NonNullable<ConnectorOptions<S, V>['selector']>,
  equalityCheck?: ConnectorOptions<S, V>['equalityCheck']
): ConnectorDecorator;
export function select<S extends Store, V>(
  options: ConnectorOptions<S, V>
): ConnectorDecorator;
export function select<S extends Store, V>(
  selectorOrOptions:
    | NonNullable<ConnectorOptions<S, V>['selector']>
    | ConnectorOptions<S, V>,
  equalityCheck?: ConnectorOptions<S, V>['equalityCheck']
): ConnectorDecorator {
  return <C extends ReactiveElement>(
    protoOrTarget: ClassAccessorDecoratorTarget<C, V>,
    nameOrContext: PropertyKey | ClassAccessorDecoratorContext<C, V>
  ) => {
    let options: ConnectorOptions<S, V> = {};
    if (typeof selectorOrOptions === 'object') {
      options = selectorOrOptions;
    } else {
      options.selector = selectorOrOptions;
      options.equalityCheck = equalityCheck;
    }
    // Map of instances to controllers
    const controllerMap = new WeakMap<ReactiveElement, Connector<S, V>>();
    if (typeof nameOrContext === 'object') {
      // Standard decorators branch
      nameOrContext.addInitializer(function (this: ReactiveElement) {
        controllerMap.set(this, new Connector(this, options));
      });
      return {
        get(this: ReactiveElement) {
          return controllerMap.get(this)!.selected;
        },
      };
    } else {
      // Experimental decorators branch
      (protoOrTarget.constructor as typeof ReactiveElement).addInitializer(
        (element: ReactiveElement): void => {
          controllerMap.set(element, new Connector(element, options));
        }
      );
      Object.defineProperty(protoOrTarget, nameOrContext, {
        get(this: ReactiveElement) {
          return controllerMap.get(this)!.selected;
        },
      });
      return;
    }
  };
}

export function dispatch<S extends Store>(): ConnectorDecorator {
  return <C extends ReactiveElement>(
    protoOrTarget: ClassAccessorDecoratorTarget<C, S['dispatch']>,
    nameOrContext: PropertyKey | ClassAccessorDecoratorContext<C, S['dispatch']>
  ) => {
    // Map of instances to controllers
    const controllerMap = new WeakMap<ReactiveElement, Connector<S, never>>();
    if (typeof nameOrContext === 'object') {
      // Standard decorators branch
      nameOrContext.addInitializer(function (this: ReactiveElement) {
        controllerMap.set(this, new Connector(this));
      });
      return {
        get(this: ReactiveElement) {
          return controllerMap.get(this)!.dispatch;
        },
      };
    } else {
      // Experimental decorators branch
      (protoOrTarget.constructor as typeof ReactiveElement).addInitializer(
        (element: ReactiveElement): void => {
          controllerMap.set(element, new Connector(element));
        }
      );
      Object.defineProperty(protoOrTarget, nameOrContext, {
        get(this: ReactiveElement) {
          return controllerMap.get(this)!.dispatch;
        },
      });
      return;
    }
  };
}

/**
 * Generates a public interface type that removes private and protected fields.
 * This allows accepting otherwise compatible versions of the type (e.g. from
 * multiple copies of the same package in `node_modules`).
 */
type Interface<T> = {
  [K in keyof T]: T[K];
};

type ConnectorDecorator = {
  // legacy
  <
    K extends PropertyKey,
    Proto extends Interface<Omit<ReactiveElement, 'renderRoot'>>,
  >(
    protoOrDescriptor: Proto,
    name?: K
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any;

  // standard
  <C extends Interface<Omit<ReactiveElement, 'renderRoot'>>, V>(
    value: ClassAccessorDecoratorTarget<C, V>,
    context: ClassAccessorDecoratorContext<C, V>
  ): void;
};
