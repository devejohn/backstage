/*
 * Copyright 2022 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createServiceFactory, createServiceRef } from './types';

describe('createServiceFactory', () => {
  it('should create a meta factory with no options', () => {
    const ref = createServiceRef<string>({ id: 'x' });
    const metaFactory = createServiceFactory({
      service: ref,
      deps: {},
      async factory(_deps) {
        return async () => 'x';
      },
    });
    expect(metaFactory).toEqual(expect.any(Function));
    expect(metaFactory().service).toBe(ref);

    // @ts-expect-error
    metaFactory('string');
    // @ts-expect-error
    metaFactory({});
    // @ts-expect-error
    metaFactory({ x: 1 });
    // @ts-expect-error
    metaFactory(null);
    metaFactory(undefined);
    metaFactory();
  });

  it('should create a meta factory with optional options', () => {
    const ref = createServiceRef<string>({ id: 'x' });
    const metaFactory = createServiceFactory({
      service: ref,
      deps: {},
      async factory(_deps, _opts?: { x: number }) {
        return async () => 'x';
      },
    });
    expect(metaFactory).toEqual(expect.any(Function));

    // @ts-expect-error
    metaFactory('string');
    // @ts-expect-error
    metaFactory({});
    metaFactory({ x: 1 });
    // @ts-expect-error
    metaFactory(null);
    metaFactory(undefined);
    metaFactory();
  });

  it('should create a meta factory with required options', () => {
    const ref = createServiceRef<string>({ id: 'x' });
    const metaFactory = createServiceFactory({
      service: ref,
      deps: {},
      async factory(_deps, _opts: { x: number }) {
        return async () => 'x';
      },
    });
    expect(metaFactory).toEqual(expect.any(Function));

    // @ts-expect-error
    metaFactory('string');
    // @ts-expect-error
    metaFactory({});
    metaFactory({ x: 1 });
    // @ts-expect-error
    metaFactory(null);
    // @ts-expect-error
    metaFactory(undefined);
    // @ts-expect-error
    metaFactory();
  });
});
