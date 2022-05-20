import { NomadMessage } from './consumerV2';

import { Prisma, PrismaClient } from '@prisma/client';
import { DbRequestType, IndexerCollector } from './metrics';
import Logger from 'bunyan';
import pLimit from 'p-limit';
import { Padded } from './utils';
import { ethers } from 'ethers';
import { BridgeContext } from '@nomad-xyz/sdk-bridge';

export interface MsgRequest {
  size?: string;
  page?: string;
  destination?: string;
  origin?: string;
  recipient?: string;
  sender?: string;
}

export class DB {
  client: PrismaClient;
  syncedOnce: boolean;
  metrics: IndexerCollector;
  logger: Logger;
  sdk: BridgeContext;

  constructor(metrics: IndexerCollector, logger: Logger, sdk: BridgeContext) {
    this.syncedOnce = false;
    this.client = new PrismaClient();
    this.metrics = metrics;
    this.logger = logger.child({ span: 'DB' });
    this.sdk = sdk;
  }

  async connect() {}

  async disconnect() {
    await this.client.$disconnect();
  }

  get startupSync() {
    const value = this.syncedOnce;
    this.syncedOnce = true;
    return !value;
  }

  async getMessageByEvm(tx: string): Promise<NomadMessage[]> {
    this.metrics.incDbRequests(DbRequestType.Select);
    const messages = await this.client.messages.findMany({
      where: {
        tx,
      },
    });

    return messages.map((m) =>
      NomadMessage.deserialize(m, this.logger, this.sdk),
    );
  }

  async getMessagesByOriginAndStateNumber(
    origin: number,
    state: number,
  ): Promise<NomadMessage[]> {
    this.metrics.incDbRequests(DbRequestType.Select);
    const messages = await this.client.messages.findMany({
      where: {
        origin,
        state,
      },
    });

    return messages.map((m) =>
      NomadMessage.deserialize(m, this.logger, this.sdk),
    );
  }

  async getMessagesByOriginAndRoot(
    origin: number,
    root: string,
  ): Promise<NomadMessage[]> {
    this.metrics.incDbRequests(DbRequestType.Select);
    const messages = await this.client.messages.findMany({
      where: {
        origin,
        root,
      },
    });
    return messages.map((m) =>
      NomadMessage.deserialize(m, this.logger, this.sdk),
    );
  }

  async getAllMessages(): Promise<NomadMessage[]> {
    this.metrics.incDbRequests(DbRequestType.Select);
    const messages = await this.client.messages.findMany();
    return messages.map((m) =>
      NomadMessage.deserialize(m, this.logger, this.sdk),
    );
  }

  async getMsgByOriginNonceAndDestination(
    origin: number,
    nonce: number,
    destination: number,
  ): Promise<NomadMessage | null> {
    this.metrics.incDbRequests(DbRequestType.Select);
    const message = await this.client.messages.findFirst({
      where: {
        origin,
        nonce,
        destination: destination,
      },
    });
    return message
      ? NomadMessage.deserialize(message, this.logger, this.sdk)
      : null;
  }

  async getMessageBySendValues(
    destination: number,
    recipient: Padded,
    amount: ethers.BigNumber,
    dispatchBlock: number,
  ): Promise<NomadMessage | null> {
    this.metrics.incDbRequests(DbRequestType.Select);
    const message = await this.client.messages.findFirst({
      where: {
        destination,
        recipient: recipient.valueOf(), // need to make sure it is right
        amount: amount.toHexString(),
        dispatchBlock,
      },
    });

    return message
      ? NomadMessage.deserialize(message, this.logger, this.sdk)
      : null;
  }

  async getMessageByHash(messageHash: string): Promise<NomadMessage | null> {
    this.metrics.incDbRequests(DbRequestType.Select);
    const message = await this.client.messages.findUnique({
      where: {
        messageHash,
      },
    });

    return message
      ? NomadMessage.deserialize(message, this.logger, this.sdk)
      : null;
  }

  async getMessages(req: MsgRequest): Promise<NomadMessage[]> {
    const take = req.size ? parseInt(req.size) : 15;
    const page = req.page ? parseInt(req.page) : 0;

    if (take < 0) throw new Error(`Cannot take less than 0`);
    if (take > 50) throw new Error(`Cannot take more than 50`);
    if (page < 0) throw new Error(`Page is less than a 0`);

    const skip = page * take;

    let where: {
      sender?: string;
      recipient?: string;
      origin?: number;
      destination?: number;
    } = {
      sender: req.sender,
      recipient: req.recipient,
    };

    if (req.origin) {
      where.origin = parseInt(req.origin);
    }

    if (req.destination) {
      where.destination = parseInt(req.destination);
    }

    this.metrics.incDbRequests(DbRequestType.Select);
    const messages = await this.client.messages.findMany({
      where,
      take,
      skip,
    });

    return messages.map((m) =>
      NomadMessage.deserialize(m, this.logger, this.sdk),
    );
  }

  async getMessageCount(origin: number): Promise<number> {
    this.metrics.incDbRequests(DbRequestType.Select);
    return await this.client.messages.count({
      where: {
        origin,
      },
    });
  }

  async insertMessage(messages: NomadMessage[]) {
    if (!messages.length) return;

    this.metrics.incDbRequests(DbRequestType.Insert, messages.length);
    await this.client.messages.createMany({
      data: messages.map((message) => {
        message.logger.debug(`Message created in DB`);
        return message.serialize();
      }),
      skipDuplicates: true,
    });

    return;
  }

  async updateMessage(messages: NomadMessage[]) {
    if (!messages.length) return;

    const limit = pLimit(10);

    await Promise.all(
      messages.map(async (m) => {
        return await limit(async () => {
          this.metrics.incDbRequests(DbRequestType.Update);

          const serialized = m.serialize();

          await this.client.messages.update({
            where: {
              messageHash: m.messageHash,
            },
            data: serialized,
          });
        });
      }),
    );

    return;
  }

  async getExistingHashes(): Promise<string[]> {
    this.metrics.incDbRequests(DbRequestType.Select);
    const rows = await this.client.messages.findMany({
      select: {
        messageHash: true,
      },
    });
    return rows.map((row) => row.messageHash);
  }

  async getAllKeyPair(namespace: string): Promise<Map<string, string>> {
    this.metrics.incDbRequests(DbRequestType.Select);
    const rows = await this.client.kv_storage.findMany({
      select: {
        key: true,
        value: true,
      },
      where: {
        namespace,
      },
    });
    return new Map(rows.map((row) => [row.key, row.value]));
  }

  async getKeyPair(
    namespace: string,
    key: string,
  ): Promise<string | undefined> {
    this.metrics.incDbRequests(DbRequestType.Select);
    const row = await this.client.kv_storage.findUnique({
      select: {
        value: true,
      },
      where: {
        namespace_key: {
          namespace,
          key,
        },
      },
    });
    if (row) return row.value;
    return undefined;
  }

  async setKeyPair(
    namespace: string,
    key: string,
    value: string,
  ): Promise<void> {
    const where: Prisma.kv_storageWhereUniqueInput = {
      namespace_key: {
        namespace,
        key,
      },
    };

    const create: Prisma.kv_storageCreateInput = {
      namespace,
      key,
      value,
    };
    const update: Prisma.kv_storageUpdateInput = {
      value,
    };
    this.metrics.incDbRequests(DbRequestType.Upsert);
    await this.client.kv_storage.upsert({
      where,
      update,
      create,
    });
  }
}
