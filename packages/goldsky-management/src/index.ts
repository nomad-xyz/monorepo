import fs from "fs";
import ejs from 'ejs';

type Domain = {
    name: string
    domain: number
}

class LocatedTable {
    name: string;
    schema: Schema;

    constructor(name: string, schema: Schema) {
        this.name = name;
        this.schema = schema;
    }

    fullName(): string {
        return `${this.schema.name}.${this.name}`;
    }
}

class Schema {
    name: string;
    tables: LocatedTable[];
    constructor(name: string) {
        this.name = name;
        this.tables = [];
    }

    registerTable(name: string) {
        this.tables.push(new LocatedTable(name, this));
    }

    registerTables(names: string[]) {
        for (const name of names) {
            this.registerTable(name);
        }
    }
}

class ViewTemplate {
    name: string;
    template: string;
    required: string[];
    constructor(name: string, templatePath: string, required: string[]) {
        this.name = name;
        this.template = fs.readFileSync(templatePath, 'utf8');
        this.required = required;
    }

    produce(destination: Schema, tables: LocatedTable[], additional?: any) {
        const replace: any = {
            location: destination.name,
            name: this.name,
            ...additional
        };
        for (const reqTable of this.required) {
            const lt = tables.find(locTable => locTable.name === reqTable);
            if (!lt) {
                console.error(`Not Found ${reqTable} in ${tables.map(t => t.fullName()).join(', ')}. Skipping...`);
                return ''
            }
            replace[reqTable] = lt.fullName();
        }

        return ejs.render(this.template, replace);
    }
}

class View extends LocatedTable {
    constructor(name: string, schema: Schema) {
        super(name, schema);
    }
}

class Env {
    name: string;
    source: Schema[];
    destination: Schema;
    domains: Domain[]

    toProduce: ViewTemplate[];

    constructor(name: string, source: Schema[], destination: Schema, domains: Domain[]) {
        this.name = name;
        this.source = source;
        this.destination = destination;
        this.domains = domains;
        this.toProduce = [];
    }

    addToProduce(...vt: ViewTemplate[]) {
        this.toProduce.push(...vt);
    }

    produce(): string {
        return this.toProduce.map(toProduce => {
            // console.log(`Going to produce for env ${this.name}, with sources: ${this.source.map(s => s.name).join(', ')}, and tables: ${this.source.map(s => s.tables).flat().map(t => t.fullName())}`)
            // this.source.forEach(s => {
            //     console.log(s.tables)
            // });
            const produced = toProduce.produce(this.destination, this.source.map(s => s.tables).flat(), {domains: this.domains});
            console.log(`Creating view '${toProduce.name}' in '${this.destination.name}'`)
            this.destination.tables.push(new View(toProduce.name, this.destination));
            return produced;
        }).join('\n\n');
    }
}


class Setup {
    envs: Env[];

    viewTemplates: ViewTemplate[];

    constructor(envs?: Env[]) {
        this.envs = envs || [];
        this.viewTemplates = [];
    }

    addView(v: ViewTemplate) {
        this.viewTemplates.push(v);
    }

    addViews(views: ViewTemplate[]) {
        for (const view of views) {
            this.addView(view)
        }
    }

    produce(): string {
        this.envs.forEach(env => env.addToProduce(...this.viewTemplates));
        return this.envs.map(env => `-- ENV ${env.name} START\n` + env.produce() + `\n-- ENV ${env.name} END\n`).join('\n\n\n');
    }
}

// Initiate source schemas with pre-existing Goldsky tables (dispatch for now)
let prodSource = new Schema('subgraph');
let devSource = new Schema('staging');
const tables = ['dispatch', 'update', 'process', 'recovery', 'process_failure', 'send', 'receive']
prodSource.registerTables(tables);
devSource.registerTables(tables);

// Destination views for both environments
let prodDest = new Schema('production_views');
let devDest = new Schema('development_views');


let prodDomainMapping: Domain[] = [
    { name: 'ethereum', domain: 6648936 },
    { name: 'avalanche', domain: 1635148152 },
    { name: 'evmos', domain: 1702260083 },
    { name: 'milkomedac1', domain: 25393 }, // Pretty much how it is named in Goldsky
    { name: 'moonbeam', domain: 1650811245 },
    { name: 'xdai', domain: 2019844457 },
]
let devDomainMapping: Domain[] = [
    { name: 'goerli', domain: 1337 },
    { name: 'sepolia', domain: 9999 },
]

// Initiate environments with source and destination schemas.
// both source and destination schemas are used as a source, to allow
// re-use of freshly created views
let prod = new Env('production', [prodSource, prodDest], prodDest, prodDomainMapping);
let dev = new Env('development', [devSource, devDest], devDest, devDomainMapping);

// Dummy super class that leads the dance
let s = new Setup([prod, dev]);

// Register views. (name, template, required tables/views by name)
let disp = new ViewTemplate('decoded_dispatch', './views/decodedDispatch.sql', [`dispatch`]);
let update = new ViewTemplate('decoded_update', './views/decodedUpdate.sql', ['update']);
let events = new ViewTemplate('events', './views/events.sql', ['decoded_dispatch', 'decoded_update', 'process']);
let numberMessages = new ViewTemplate('number_messages', './views/numberMessages.sql', ['events']);
let recovery = new ViewTemplate('recovery_view', './views/recovery.sql', ['recovery']);
let processFailure = new ViewTemplate('process_failure_view', './views/processFailure.sql', ['process_failure']);
let bridgeEvents = new ViewTemplate('bridge_events', './views/bridgeEvents.sql', ['events', 'send', 'receive']);
let sendTokens = new ViewTemplate('send_tokens', './views/sendTokens.sql', ['send']);
let validReceiveTokenAmts = new ViewTemplate('valid_receive_token_amts', './views/validReceiveTokenAmts.sql', ['receive', 'events']);
let affectedTokenAmounts = new ViewTemplate('affected_token_amounts', './views/affectedTokenAmounts.sql', ['send_tokens', 'valid_receive_token_amts']);
let undispatchedProcess = new ViewTemplate('undispatched_process', './views/undispatchedProcess.sql', ['dispatch', 'process']);
let willMintNew = new ViewTemplate('will_mint_new', './views/willMintNew.sql', ['events']);
let willMintNewAll = new ViewTemplate('will_mint_new_all', './views/willMintNewAll.sql', ['events']);
s.addViews([disp, update, events, numberMessages, recovery, processFailure, bridgeEvents, sendTokens, validReceiveTokenAmts, affectedTokenAmounts, undispatchedProcess, willMintNew, willMintNewAll]);

// Output the result
fs.writeFileSync('./query.sql', s.produce())
