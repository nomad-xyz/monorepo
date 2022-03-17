oclif-hello-world
=================

oclif example Hello World CLI

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/oclif-hello-world.svg)](https://npmjs.org/package/oclif-hello-world)
[![CircleCI](https://circleci.com/gh/oclif/hello-world/tree/main.svg?style=shield)](https://circleci.com/gh/oclif/hello-world/tree/main)
[![Downloads/week](https://img.shields.io/npm/dw/oclif-hello-world.svg)](https://npmjs.org/package/oclif-hello-world)
[![License](https://img.shields.io/npm/l/oclif-hello-world.svg)](https://github.com/oclif/hello-world/blob/main/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @nomad-xyz/cli
$ nomad COMMAND
running command...
$ nomad (--version)
@nomad-xyz/cli/0.0.0 darwin-arm64 node-v17.3.0
$ nomad --help [COMMAND]
USAGE
  $ nomad COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`nomad hello PERSON`](#nomad-hello-person)
* [`nomad hello world`](#nomad-hello-world)
* [`nomad help [COMMAND]`](#nomad-help-command)
* [`nomad plugins`](#nomad-plugins)
* [`nomad plugins:inspect PLUGIN...`](#nomad-pluginsinspect-plugin)
* [`nomad plugins:install PLUGIN...`](#nomad-pluginsinstall-plugin)
* [`nomad plugins:link PLUGIN`](#nomad-pluginslink-plugin)
* [`nomad plugins:uninstall PLUGIN...`](#nomad-pluginsuninstall-plugin)
* [`nomad plugins update`](#nomad-plugins-update)

## `nomad hello PERSON`

Say hello

```
USAGE
  $ nomad hello [PERSON] -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Whom is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ oex hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [dist/commands/hello/index.ts](https://github.com/nomad-xyz/monorepo/blob/v0.0.0/dist/commands/hello/index.ts)_

## `nomad hello world`

Say hello world

```
USAGE
  $ nomad hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ oex hello world
  hello world! (./src/commands/hello/world.ts)
```

## `nomad help [COMMAND]`

Display help for nomad.

```
USAGE
  $ nomad help [COMMAND] [-n]

ARGUMENTS
  COMMAND  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for nomad.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v5.1.10/src/commands/help.ts)_

## `nomad plugins`

List installed plugins.

```
USAGE
  $ nomad plugins [--core]

FLAGS
  --core  Show core plugins.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ nomad plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v2.0.11/src/commands/plugins/index.ts)_

## `nomad plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ nomad plugins:inspect PLUGIN...

ARGUMENTS
  PLUGIN  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ nomad plugins:inspect myplugin
```

## `nomad plugins:install PLUGIN...`

Installs a plugin into the CLI.

```
USAGE
  $ nomad plugins:install PLUGIN...

ARGUMENTS
  PLUGIN  Plugin to install.

FLAGS
  -f, --force    Run yarn install with force flag.
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Installs a plugin into the CLI.

  Can be installed from npm or a git url.

  Installation of a user-installed plugin will override a core plugin.

  e.g. If you have a core plugin that has a 'hello' command, installing a user-installed plugin with a 'hello' command
  will override the core plugin implementation. This is useful if a user needs to update core plugin functionality in
  the CLI without the need to patch and update the whole CLI.

ALIASES
  $ nomad plugins add

EXAMPLES
  $ nomad plugins:install myplugin 

  $ nomad plugins:install https://github.com/someuser/someplugin

  $ nomad plugins:install someuser/someplugin
```

## `nomad plugins:link PLUGIN`

Links a plugin into the CLI for development.

```
USAGE
  $ nomad plugins:link PLUGIN

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.

EXAMPLES
  $ nomad plugins:link myplugin
```

## `nomad plugins:uninstall PLUGIN...`

Removes a plugin from the CLI.

```
USAGE
  $ nomad plugins:uninstall PLUGIN...

ARGUMENTS
  PLUGIN  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ nomad plugins unlink
  $ nomad plugins remove
```

## `nomad plugins update`

Update installed plugins.

```
USAGE
  $ nomad plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```
<!-- commandsstop -->
