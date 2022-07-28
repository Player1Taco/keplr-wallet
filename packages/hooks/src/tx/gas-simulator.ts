import { IGasConfig, IGasSimulator } from "./types";
import {
  action,
  autorun,
  computed,
  IReactionDisposer,
  makeObservable,
  observable,
  runInAction,
} from "mobx";
import { useEffect, useState } from "react";
import { KVStore } from "@keplr-wallet/common";
import { ChainIdHelper } from "@keplr-wallet/cosmos";

export type SimulateGasFn = () => Promise<number>;

export class GasSimulator implements IGasSimulator {
  @observable
  protected _chainId: string;

  @observable
  protected _key: string;

  @observable
  protected _gasAdjustmentRaw: string = "1.3";

  @observable
  protected _enabled: boolean = false;

  @observable
  protected _isSimulating: boolean = false;

  // Key is the store key (probably, ${chainIdentifier}/${key})
  // Value is the last stored value.
  // If the value is null, it means that there is no value stored or being loaded.
  @observable.shallow
  protected _initialGasEstimatedMap: Map<string, number | null> = new Map();

  @observable.shallow
  protected _recentGasEstimatedMap: Map<string, number> = new Map();

  protected _disposers: IReactionDisposer[] = [];

  constructor(
    // TODO: Add comment about the reason why kvStore field is not observable.
    protected kvStore: KVStore,
    protected readonly initialChainId: string,
    protected readonly gasConfig: IGasConfig,
    protected readonly initialKey: string,
    // TODO: Add comment about the reason why simulateGasFn field is not observable.
    protected simulateGasFn: SimulateGasFn
  ) {
    this._chainId = initialChainId;
    this._key = initialKey;

    makeObservable(this);

    this.init();
  }

  setKVStore(kvStore: KVStore) {
    this.kvStore = kvStore;
  }

  get chainId(): string {
    return this._chainId;
  }

  @action
  setChainId(value: string) {
    this._chainId = value;
  }

  get key(): string {
    return this._key;
  }

  @action
  setKey(value: string) {
    this._key = value;
  }

  get isSimulating(): boolean {
    return this._isSimulating;
  }

  setSimulateGasFn(simulateGasFn: SimulateGasFn) {
    this.simulateGasFn = simulateGasFn;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  @action
  setEnabled(value: boolean) {
    this._enabled = value;
  }

  get gasEstimated(): number | undefined {
    const key = this.storeKey;
    if (this._recentGasEstimatedMap.has(key)) {
      return this._recentGasEstimatedMap.get(key);
    }

    const saved = this._initialGasEstimatedMap.get(key);
    if (saved != null) {
      return saved;
    }

    return undefined;
  }

  get gasAdjustment(): number {
    if (this._gasAdjustmentRaw === "") {
      return 0;
    }

    const num = parseFloat(this._gasAdjustmentRaw);
    if (Number.isNaN(num) || num < 0) {
      return 0;
    }

    return num;
  }

  get gasAdjustmentRaw(): string {
    return this._gasAdjustmentRaw;
  }

  @action
  setGasAdjustment(gasAdjustment: string | number) {
    if (typeof gasAdjustment === "number") {
      if (gasAdjustment < 0 || gasAdjustment > 2) {
        return;
      }

      this._gasAdjustmentRaw = gasAdjustment.toString();
      return;
    }

    if (gasAdjustment === "") {
      this._gasAdjustmentRaw = "";
      return;
    }

    if (gasAdjustment.startsWith(".")) {
      this._gasAdjustmentRaw = "0" + gasAdjustment;
    }

    const num = parseFloat(gasAdjustment);
    if (Number.isNaN(num) || num < 0 || num > 2) {
      return;
    }

    this._gasAdjustmentRaw = gasAdjustment;
  }

  protected init() {
    this._disposers.push(
      autorun(() => {
        if (!this.enabled) {
          return;
        }

        const key = this.storeKey;
        if (!this._initialGasEstimatedMap.has(key)) {
          this._initialGasEstimatedMap.set(key, null);
          this.kvStore.get<number>(key).then((saved) => {
            if (saved) {
              runInAction(() => {
                this._initialGasEstimatedMap.set(key, saved);
              });
            }
          });
        }
      })
    );

    this._disposers.push(
      autorun(() => {
        if (!this.enabled) {
          return;
        }

        const key = this.storeKey;

        // The lines below look a bit odd...
        // But did this intentionally because we have to catch the error in both cases,
        // the error from the function returning the promise and the error from the returned promise.
        try {
          const promise = this.simulateGasFn();

          // TODO: Add debounce logic?

          runInAction(() => {
            this._isSimulating = true;
          });

          promise
            .then((gasEstimated) => {
              runInAction(() => {
                this._recentGasEstimatedMap.set(key, gasEstimated);
              });
              this.kvStore.set(key, gasEstimated).catch((e) => {
                console.log(e);
              });
            })
            .catch((e) => {
              console.log(e);
            })
            .finally(() => {
              runInAction(() => {
                this._isSimulating = false;
              });
            });
        } catch (e) {
          console.log(e);
          return;
        }
      })
    );

    this._disposers.push(
      autorun(() => {
        if (this.enabled && this.gasEstimated != null) {
          this.gasConfig.setGas(this.gasEstimated * this.gasAdjustment);
        }
      })
    );
  }

  dispose() {
    for (const disposer of this._disposers) {
      disposer();
    }
  }

  @computed
  protected get storeKey(): string {
    const chainIdentifier = ChainIdHelper.parse(this.chainId);
    return `${chainIdentifier.identifier}/${this.key}`;
  }
}

// CONTRACT: Use with `observer`
export const useGasSimulator = (
  kvStore: KVStore,
  chainId: string,
  gasConfig: IGasConfig,
  key: string,
  simulateGasFn: SimulateGasFn,
  initialDisabled?: boolean
) => {
  const [gasSimulator] = useState(() => {
    const gasSimulator = new GasSimulator(
      kvStore,
      chainId,
      gasConfig,
      key,
      simulateGasFn
    );
    if (initialDisabled) {
      gasSimulator.setEnabled(false);
    } else {
      gasSimulator.setEnabled(true);
    }

    return gasSimulator;
  });
  gasSimulator.setKVStore(kvStore);
  gasSimulator.setChainId(chainId);
  gasSimulator.setKey(key);
  gasSimulator.setSimulateGasFn(simulateGasFn);

  useEffect(() => {
    return () => {
      gasSimulator.dispose();
    };
  }, [gasSimulator]);

  return gasSimulator;
};
