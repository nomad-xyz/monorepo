import { NomadMessage } from "./consumer";

import { Prisma, PrismaClient } from '@prisma/client'
import { DbRequestType, IndexerCollector } from "./metrics";
import Logger from "bunyan";
import pLimit from 'p-limit';

// function fromDb(m: messages): NomadMessage {
//   return 

// }

// function toDb(m: NomadMessage): Prisma.messagesCreateManyInput {
//   return {
//     hash: m.hash,
//     origin: m.origin,
//     destination: m.destination,
//     nonce: m.nonce,
//     nomad_sender: m.nomadSender,
//     nomad_recipient: m.nomadRecipient,
//     root: m.root,
//     state: m.state,
//     block: m.block,
//     dispatched_at: m.timings.dispatchedAt,
//     updated_at: m.timings.updatedAt,
//     relayed_at: m.timings.relayedAt,
//     received_at: m.timings.receivedAt,
//     processed_at: m.timings.processedAt,
//     sender: m.sender,
//     bridge_msg_type: m.bridgeMsgType,
//     recipient: m.bridgeMsgTo,
//     bridge_msg_amount: m.bridgeMsgAmount?.toHexString() || undefined,
//     bridge_msg_allow_fast: m.bridgeMsgAllowFast,
//     bridge_msg_details_hash: m.bridgeMsgDetailsHash,
//     bridge_msg_token_domain: m.bridgeMsgTokenDomain,
//     bridge_msg_token_id: m.bridgeMsgTokenId,
//     raw: m.raw,
//     leaf_index: m.leafIndex.toHexString(),
//     evm: m.evm,
//   }
// }

export interface MsgRequest {
  size?: number;
  page?: number;
  destination?: number;
  origin?: number;
  recipient?: string;
  sender?: string;
}


export class DB {
  client: PrismaClient;
  syncedOnce: boolean;
  metrics: IndexerCollector;
  logger: Logger;

  constructor(metrics: IndexerCollector, logger: Logger) {
    this.syncedOnce = false;
    this.client = new PrismaClient();
    this.metrics = metrics;
    this.logger = logger.child({span: 'DB'});
  }

  async connect() {
  }

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
        tx
      }
    });

    return messages.map(m => NomadMessage.deserialize(m, this.logger))
  }

  async getMessageByHash(messageHash: string): Promise<NomadMessage | undefined> {
    this.metrics.incDbRequests(DbRequestType.Select);
    const message = await this.client.messages.findUnique({
      where: {
        messageHash
      }
    });

    return message ? NomadMessage.deserialize(message, this.logger) : undefined
  }

  async getMessages(req: MsgRequest): Promise<NomadMessage[]> {
    const take = req.size || 15;
    const page = req.page || 1;
    const skip = (page || -1) * take;

    this.metrics.incDbRequests(DbRequestType.Select);
    const messages = await this.client.messages.findMany({
      where: {
        sender: req.sender,
        recipient: req.recipient,
        origin: req.origin,
        destination: req.destination,
      },
      take,
      skip
    });

    return messages.map(m => NomadMessage.deserialize(m, this.logger))
  }

  async getMessageCount(origin: number): Promise<number> {
    this.metrics.incDbRequests(DbRequestType.Select);
    return await this.client.messages.count({
      where: {
        origin
      }
    });
  }

  async insertMessage(messages: NomadMessage[]) {
    if (!messages.length) return;
    
    this.metrics.incDbRequests(DbRequestType.Insert);
    await this.client.messages.createMany({
      data: messages.map(message => {
        message.logger.debug(`Message created in DB`);
        return message.serialize()
      }),
      skipDuplicates: true,
    })

    return;
  }

  async updateMessage(messages: NomadMessage[]) {
    if (!messages.length) return;

    const limit = pLimit(10);

    await Promise.all(messages.map(async (m) => {
      return await limit(async () => {
        this.metrics.incDbRequests(DbRequestType.Update);
        
        const serialized = m.serialize();
        await this.client.messages.update({
          where: {
            messageHash: m.messageHash
          },
          data: serialized,
        });
        m.logger.debug(`Message updated in DB. updated: ${serialized.updatedAt}, relayed: ${serialized.relayedAt}, received: ${serialized.receivedAt}, processed: ${serialized.processedAt}`);
      })
    }));

    return
  }

  async getExistingHashes(): Promise<string[]> {
    this.metrics.incDbRequests(DbRequestType.Select);
    const rows = await this.client.messages.findMany({
      select: {
        messageHash: true
      }
    });
    return rows.map(row => row.messageHash)
  }

  async getAllKeyPair(namespace: string): Promise<Map<string, string>> {
    this.metrics.incDbRequests(DbRequestType.Select);
    const rows = await this.client.kv_storage.findMany({
      select: {
        key: true,
        value: true
      },
      where: {
        namespace
      }
    });
    return new Map(rows.map(row => [row.key, row.value]))
  }

  async getKeyPair(namespace: string, key: string): Promise<string | undefined> {
    this.metrics.incDbRequests(DbRequestType.Select);
    const row = await this.client.kv_storage.findUnique({
      select: {
        value: true
      },
      where: {
        namespace_key: {
          namespace,
          key
        }
      }
    });
    if (row) return row.value;
    return undefined
  }

  async setKeyPair(namespace: string, key: string, value: string): Promise<void> {
    const where: Prisma.kv_storageWhereUniqueInput = {
      namespace_key: {
        namespace, key
      }
    };

    const create: Prisma.kv_storageCreateInput = {
      namespace, key, value
    };
    const update: Prisma.kv_storageUpdateInput =  {
      value
    };
    this.metrics.incDbRequests(DbRequestType.Upsert);
    await this.client.kv_storage.upsert({
      where,
      update,
      create,
    })

    // const found = await this.getKeyPair(namespace, key);
    // if (found) {
    //   await this.client.kv_storage.update({
    //     where,
    //     data: update,
    //   })
    // } else {
    //   await this.client.kv_storage.create({
    //     data: create
    //   })
    // }
  }
}
