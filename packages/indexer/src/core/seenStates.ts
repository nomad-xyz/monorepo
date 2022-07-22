export enum CoreMsgState {
  Dispatched,
  Updated,
  Relayed,
  Processed,
}

const states: Record<string, CoreMsgState> = {
  dispatched: CoreMsgState.Dispatched,
  updated: CoreMsgState.Updated,
  relayed: CoreMsgState.Relayed,
  processed: CoreMsgState.Processed,
};

class SeenStates {
  ts: Date;
  dispatched: boolean;
  updated: boolean;
  relayed: boolean;
  processed: boolean;

  constructor() {
    this.ts = new Date();
    this.dispatched = false;
    this.updated = false;
    this.relayed = false;
    this.processed = false;
  }

  seen(state: CoreMsgState) {
    if (state === CoreMsgState.Dispatched) {
      return this.seenDispatch();
    } else if (state === CoreMsgState.Updated) {
      return this.seenUpdate();
    } else if (state === CoreMsgState.Relayed) {
      return this.seenRelay();
    } else {
      return this.seenProcess();
    }
  }

  seenDispatch(): boolean {
    const temp = this.dispatched;
    this.dispatched = true;
    return temp;
  }

  seenUpdate(): boolean {
    const temp = this.updated;
    this.updated = true;
    return temp;
  }

  seenRelay(): boolean {
    const temp = this.relayed;
    this.relayed = true;
    return temp;
  }

  seenProcess(): boolean {
    const temp = this.processed;
    this.processed = true;
    return temp;
  }
}

type Hash = string;

export class MsgSync {
  map: Map<Hash, SeenStates>;
  retention: number;
  cleanAfter: number;
  current: number;

  constructor(retention: number, cleanAfter = 20) {
    this.map = new Map();
    this.retention = retention;
    this.cleanAfter = cleanAfter - 1;
    this.current = 0;
  }

  needToClean(): boolean {
    if (this.current >= this.cleanAfter) {
      this.current = 0;
      return true;
    }
    this.current += 1;
    return false;
  }

  checkAndClean() {
    const now = new Date().valueOf();
    const removeKeys: Hash[] = [];
    Array.from(this.map.entries()).forEach(([k, v]) => {
      if (now - v.ts.valueOf() > this.retention) removeKeys.push(k);
    });

    removeKeys.forEach((k) => {
      this.map.delete(k);
    });
  }

  seen(hash: Hash, somehowState: CoreMsgState | string): boolean {
    let state: CoreMsgState;
    if (typeof somehowState === 'string') {
      const foundState = states[somehowState];
      if (foundState === undefined)
        throw new Error(
          `State ${somehowState} is not found, or doesn't belong to core state`,
        );
      state = foundState;
    } else {
      state = somehowState;
    }

    let seen;
    if (this.map.has(hash)) {
      seen = this.map.get(hash)!.seen(state);
    } else {
      const seenStates = new SeenStates();
      seenStates.seen(state);
      this.map.set(hash, seenStates);
      seen = false;
    }

    if (this.needToClean()) {
      this.checkAndClean();
    }

    return seen;
  }
}

// const s = new MsgSync(3, 3);

// let q = s.seen('kek', 'dispatched');
// console.log(`q->`, q === false);

// q = s.seen('kek', 'dispatched');
// console.log(`q->`, q === true);

// setTimeout(() => {
//     q = s.seen('kek', 'updated');
//     console.log(`q->`, q === false);

//     q = s.seen('kek', 'updated');
//     console.log(`q->`, q === false);
// }, 3000)
