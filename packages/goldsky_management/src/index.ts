import fs from "fs";
import ejs from 'ejs';

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
}

class ViewTemplate {
    name: string;
    template: string;
    required: string[];
    constructor(name: string, template: string, required: string[]) {
        this.name = name;
        this.template = template;
        this.required = required;
    }

    produce(destination: Schema, tables: LocatedTable[]) {
        const replace: any = {
            location: destination.name,
            name: this.name,
        };
        this.required.forEach(reqTable => {
            const lt = tables.find(locTable => locTable.name === reqTable);
            if (!lt) throw new Error(`Not Found ${reqTable} in ${tables.map(t => t.fullName()).join(', ')}`);
            replace[reqTable] = lt.fullName();
        })

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

    toProduce: ViewTemplate[];

    constructor(name: string, source: Schema[], destination: Schema) {
        this.name = name;
        this.source = source;
        this.destination = destination;
        this.toProduce = []
    }

    addToProduce(...vt: ViewTemplate[]) {
        this.toProduce.push(...vt);
    }

    produce(): string {
        return this.toProduce.map(toProduce => {
            console.log(`Going to produce for env ${this.name}, with sources: ${this.source.map(s => s.name).join(', ')}, and tables: ${this.source.map(s => s.tables).flat().map(t => t.fullName())}`)
            this.source.forEach(s => {
                console.log(s.tables)
            });
            const produced = toProduce.produce(this.destination, this.source.map(s => s.tables).flat());
            console.log(`Creating view '${toProduce.name}' in '${this.destination.name}'`)
            this.destination.tables.push(new View(toProduce.name, this.destination));
            return produced;
        }).join('\n\n------\n\n');
    }
}


class Setup {
    envs: Env[];

    viewTemplates: ViewTemplate[];

    constructor(envs?: Env[]) {
        this.envs = envs || [];
        this.viewTemplates = [];
    }

    addView(...v: ViewTemplate[]) {
        this.viewTemplates.push(...v);
    }

    produce(): string {
        this.envs.forEach(env => env.addToProduce(...this.viewTemplates));
        return this.envs.map(env => env.produce()).join('\n\n\n====\n\n\n');
    }
}

// Initiate source schemas with pre-existing Goldsky tables (dispatch for now)
let prodSource = new Schema('subgraph');
let stageSource = new Schema('staging');
prodSource.registerTable('dispatch');
stageSource.registerTable('dispatch');

// Destination views for both environments
let prodDest = new Schema('prod_views');
let stageDest = new Schema('staging_views');

// Initiate environments with source and destination schemas.
// both source and destination schemas are used as a source, to allow
// re-use of freshly created views
let prod = new Env('production', [prodSource, prodDest], prodDest);
let stage = new Env('staging', [stageSource, stageDest], stageDest);

// Dummy super class that leads the dance
let s = new Setup([prod, stage]);

// Register views. (name, template, required tables/views by name)
let disp = new ViewTemplate('decoded_dispatch', fs.readFileSync('./views/decodedDispatch.sql', 'utf8'), ['dispatch']);
let events = new ViewTemplate('events', fs.readFileSync('./views/events.sql', 'utf8'), ['decoded_dispatch']);
s.addView(disp);
s.addView(events);

// Output the result
fs.writeFileSync('./query.sql', s.produce())
