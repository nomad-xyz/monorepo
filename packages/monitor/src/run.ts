import { MonitorConfig } from './config';
import { RelayLatencyMonitor } from './latencies/relayer/relayerMonitor';
import { ProcessorLatencyMonitor } from './latencies/processor/processorMonitor';
import { BridgeHealthMonitor } from './bridgeHealth/healthMonitor';
import { E2ELatencyMonitor } from './latencies/e2e/e2eMonitor';

export enum Script {
  Health = 'health',
  Relayer = 'relayer',
  Processor = 'processor',
  E2E = 'e2e',
}

const args = process.argv.slice(2);
const script = args[0];
const origin = args[1];

(async () => {
  const config = new MonitorConfig(script, origin);
  switch (script) {
    case Script.Health:
      await new BridgeHealthMonitor(config).main();
      break;
    case Script.E2E:
      await new E2ELatencyMonitor(config).main();
      break;
    case Script.Relayer:
      await new RelayLatencyMonitor(config).main();
      break;
    case Script.Processor:
      await new ProcessorLatencyMonitor(config).main();
      break;
    default:
      throw new Error(`Undefined script found: ${script}`);
  }
})();
