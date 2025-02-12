/*
 * Copyright 2021 The Backstage Authors
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

import { useKubernetesObjects } from './useKubernetesObjects';
import { Entity } from '@backstage/catalog-model';
import { renderHook } from '@testing-library/react-hooks';
import { useApi } from '@backstage/core-plugin-api';

jest.mock('@backstage/core-plugin-api');

const entity = {
  metadata: {
    name: 'some-entity',
  },
} as Entity;

const entityWithAuthToken = {
  auth: {
    google: 'some-token',
  },
  entity,
};

const mockResponse = {
  items: [
    {
      cluster: { name: 'some-cluster' },
      resources: [
        {
          type: 'pods',
          resources: [
            {
              metadata: {
                name: 'some-pod',
              },
            },
          ],
        },
      ],
      errors: [],
    },
  ],
};

const getClustersResponse = [
  {
    name: 'cluster-a',
    authProvider: 'google',
  },
  {
    name: 'cluster-b',
    authProvider: 'authprovider2',
  },
];

describe('useKubernetesObjects', () => {
  const mockGetClusters = jest.fn();
  const mockGetObjectsByEntity = jest.fn();
  const mockDecorateRequestBodyForAuth = jest.fn();

  const expectMocksCalledCorrectly = (numOfCalls: number = 1) => {
    expect(mockGetClusters).toHaveBeenCalledTimes(numOfCalls);
    expect(mockGetClusters).toHaveBeenLastCalledWith();
    expect(mockDecorateRequestBodyForAuth).toHaveBeenCalledTimes(
      numOfCalls * 2,
    );
    expect(mockDecorateRequestBodyForAuth).toHaveBeenCalledWith('google', {
      entity,
    });
    expect(mockDecorateRequestBodyForAuth).toHaveBeenCalledWith(
      'authprovider2',
      entityWithAuthToken,
    );
    expect(mockGetObjectsByEntity).toHaveBeenCalledTimes(numOfCalls);
    expect(mockGetObjectsByEntity).toHaveBeenLastCalledWith(
      entityWithAuthToken,
    );
  };

  afterEach(() => {
    jest.resetAllMocks();
  });
  it('should return objects', async () => {
    (useApi as any).mockReturnValue({
      getClusters: mockGetClusters.mockResolvedValue(getClustersResponse),
      getObjectsByEntity:
        mockGetObjectsByEntity.mockResolvedValue(mockResponse),
      decorateRequestBodyForAuth:
        mockDecorateRequestBodyForAuth.mockResolvedValue(entityWithAuthToken),
    });
    const { result, waitForNextUpdate } = renderHook(() =>
      useKubernetesObjects(entity),
    );

    await waitForNextUpdate();

    expect(result.current.error).toBeUndefined();
    expect(result.current.kubernetesObjects).toStrictEqual(mockResponse);

    expectMocksCalledCorrectly();
  });
  it('should update on an interval', async () => {
    (useApi as any).mockReturnValue({
      getClusters: mockGetClusters.mockResolvedValue(getClustersResponse),
      getObjectsByEntity:
        mockGetObjectsByEntity.mockResolvedValue(mockResponse),
      decorateRequestBodyForAuth:
        mockDecorateRequestBodyForAuth.mockResolvedValue(entityWithAuthToken),
    });
    const { result, waitForNextUpdate } = renderHook(() =>
      useKubernetesObjects(entity, 100),
    );

    await waitForNextUpdate();
    expect(result.current.error).toBeUndefined();

    await waitForNextUpdate();

    expect(result.current.error).toBeUndefined();
    expect(result.current.kubernetesObjects).toStrictEqual(mockResponse);

    expectMocksCalledCorrectly(2);
  });
  it('should return error when getObjectsByEntity throws', async () => {
    (useApi as any).mockReturnValue({
      getClusters: mockGetClusters.mockResolvedValue(getClustersResponse),
      getObjectsByEntity: mockGetObjectsByEntity.mockRejectedValue({
        message: 'some error',
      }),
      decorateRequestBodyForAuth:
        mockDecorateRequestBodyForAuth.mockResolvedValue(entityWithAuthToken),
    });
    const { result, waitForNextUpdate } = renderHook(() =>
      useKubernetesObjects(entity),
    );

    await waitForNextUpdate();

    expect(result.current.error).toBe('some error');
    expect(result.current.kubernetesObjects).toBeUndefined();

    expectMocksCalledCorrectly();
  });

  it('should return error when getClusters throws', async () => {
    (useApi as any).mockReturnValue({
      getClusters: mockGetClusters.mockRejectedValue({ message: 'some-error' }),
      getObjectsByEntity: mockGetObjectsByEntity,
      decorateRequestBodyForAuth: mockDecorateRequestBodyForAuth,
    });
    const { result, waitForNextUpdate } = renderHook(() =>
      useKubernetesObjects(entity),
    );

    await waitForNextUpdate();

    expect(result.current.error).toBe('some-error');
    expect(result.current.kubernetesObjects).toBeUndefined();

    expect(mockGetClusters).toHaveBeenCalledTimes(1);
    expect(mockGetClusters).toHaveBeenLastCalledWith();
    expect(mockDecorateRequestBodyForAuth).toHaveBeenCalledTimes(0);
    expect(mockGetObjectsByEntity).toHaveBeenCalledTimes(0);
  });
  it('should return error when decorateRequestBodyForAuth throws', async () => {
    (useApi as any).mockReturnValue({
      getClusters: mockGetClusters.mockResolvedValue(getClustersResponse),
      decorateRequestBodyForAuth:
        mockDecorateRequestBodyForAuth.mockRejectedValue({
          message: 'some-error',
        }),
      getObjectsByEntity: mockGetObjectsByEntity,
    });
    const { result, waitForNextUpdate } = renderHook(() =>
      useKubernetesObjects(entity),
    );

    await waitForNextUpdate();

    expect(result.current.error).toBe('some-error');
    expect(result.current.kubernetesObjects).toBeUndefined();

    expect(mockGetClusters).toHaveBeenCalledTimes(1);
    expect(mockGetClusters).toHaveBeenLastCalledWith();
    expect(mockDecorateRequestBodyForAuth).toHaveBeenCalledTimes(1);
    expect(mockDecorateRequestBodyForAuth).toHaveBeenCalledWith('google', {
      entity,
    });
    expect(mockGetObjectsByEntity).toHaveBeenCalledTimes(0);
  });

  describe('when retrying', () => {
    it('should reset error after getClusters has failed and then succeeded', async () => {
      (useApi as any).mockReturnValue({
        getClusters: mockGetClusters
          .mockRejectedValueOnce({ message: 'some-error' })
          .mockResolvedValue(getClustersResponse),
        decorateRequestBodyForAuth:
          mockDecorateRequestBodyForAuth.mockResolvedValue(entityWithAuthToken),
        getObjectsByEntity:
          mockGetObjectsByEntity.mockResolvedValue(mockResponse),
      });

      const { result, waitForNextUpdate } = renderHook(() =>
        useKubernetesObjects(entity, 100),
      );

      await waitForNextUpdate();

      expect(result.current.error).toBe('some-error');
      expect(result.current.kubernetesObjects).toBeUndefined();

      await waitForNextUpdate();

      expect(result.current.error).toBeUndefined();
      expect(result.current.kubernetesObjects).not.toBeUndefined();
    });

    it('should reset error after decorateRequestBodyForAuth has failed and then succeeded', async () => {
      (useApi as any).mockReturnValue({
        getClusters: mockGetClusters.mockResolvedValue(getClustersResponse),
        decorateRequestBodyForAuth: mockDecorateRequestBodyForAuth
          .mockRejectedValueOnce({ message: 'decoration failed' })
          .mockResolvedValue(entityWithAuthToken),
        getObjectsByEntity:
          mockGetObjectsByEntity.mockResolvedValue(mockResponse),
      });

      const { result, waitForNextUpdate } = renderHook(() =>
        useKubernetesObjects(entity, 100),
      );

      await waitForNextUpdate();

      expect(result.current.error).toBe('decoration failed');
      expect(result.current.kubernetesObjects).toBeUndefined();

      await waitForNextUpdate();

      expect(result.current.error).toBeUndefined();
      expect(result.current.kubernetesObjects).not.toBeUndefined();
    });

    it('should reset error after getObjectsByEntity has failed and then succeeded', async () => {
      (useApi as any).mockReturnValue({
        getClusters: mockGetClusters.mockResolvedValue(getClustersResponse),
        decorateRequestBodyForAuth:
          mockDecorateRequestBodyForAuth.mockResolvedValue(entityWithAuthToken),
        getObjectsByEntity: mockGetObjectsByEntity
          .mockRejectedValueOnce({ message: 'failed to fetch' })
          .mockResolvedValue(mockResponse),
      });

      const { result, waitForNextUpdate } = renderHook(() =>
        useKubernetesObjects(entity, 100),
      );

      await waitForNextUpdate();

      expect(result.current.error).toBe('failed to fetch');
      expect(result.current.kubernetesObjects).toBeUndefined();

      await waitForNextUpdate();

      expect(result.current.error).toBeUndefined();
      expect(result.current.kubernetesObjects).not.toBeUndefined();
    });

    it('should reset data after getClusters succeeded then failed', async () => {
      (useApi as any).mockReturnValue({
        getClusters: mockGetClusters
          .mockResolvedValueOnce(getClustersResponse)
          .mockRejectedValue({ message: 'fetch clusters failed' }),
        decorateRequestBodyForAuth:
          mockDecorateRequestBodyForAuth.mockResolvedValue(entityWithAuthToken),
        getObjectsByEntity:
          mockGetObjectsByEntity.mockResolvedValue(mockResponse),
      });
      const { result, waitForNextUpdate } = renderHook(() =>
        useKubernetesObjects(entity, 100),
      );

      await waitForNextUpdate();

      expect(result.current.error).toBeUndefined();
      expect(result.current.kubernetesObjects).not.toBeUndefined();

      await waitForNextUpdate();

      expect(result.current.error).toBe('fetch clusters failed');
      expect(result.current.kubernetesObjects).toBeUndefined();
    });

    it('should reset data after decorateBodyForAuth succeeded then failed', async () => {
      (useApi as any).mockReturnValue({
        getClusters: mockGetClusters.mockResolvedValue(getClustersResponse),
        decorateRequestBodyForAuth: mockDecorateRequestBodyForAuth
          // this call happens twice per successful hook render
          .mockResolvedValueOnce(entityWithAuthToken)
          .mockResolvedValueOnce(entityWithAuthToken)
          .mockRejectedValue({ message: 'decorate failed' }),
        getObjectsByEntity:
          mockGetObjectsByEntity.mockResolvedValue(mockResponse),
      });

      const { result, waitForNextUpdate } = renderHook(() =>
        useKubernetesObjects(entity, 100),
      );

      await waitForNextUpdate();

      expect(result.current.error).toBeUndefined();
      expect(result.current.kubernetesObjects).not.toBeUndefined();

      await waitForNextUpdate();

      expect(result.current.error).toBe('decorate failed');
      expect(result.current.kubernetesObjects).toBeUndefined();
    });

    it('should reset data after getObjectsByEntity succeeded then failed', async () => {
      (useApi as any).mockReturnValue({
        getClusters: mockGetClusters.mockResolvedValue(getClustersResponse),
        decorateRequestBodyForAuth:
          mockDecorateRequestBodyForAuth.mockResolvedValue(entityWithAuthToken),
        getObjectsByEntity: mockGetObjectsByEntity
          .mockResolvedValueOnce(mockResponse)
          .mockRejectedValue({ message: 'failed to fetch' }),
      });

      const { result, waitForNextUpdate } = renderHook(() =>
        useKubernetesObjects(entity, 100),
      );

      await waitForNextUpdate();

      expect(result.current.error).toBeUndefined();
      expect(result.current.kubernetesObjects).not.toBeUndefined();

      await waitForNextUpdate();

      expect(result.current.error).toBe('failed to fetch');
      expect(result.current.kubernetesObjects).toBeUndefined();
    });
  });
});
