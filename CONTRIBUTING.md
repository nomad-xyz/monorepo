## Contributing to the Nomad Monorepo

🎈 Thanks for your help improving the project! We are so happy to have you!

**No contribution is too small and all contributions are valued.**

This guide will help you get started. Do not let this guide intimidate you. It
should be considered a map to help you navigate the process. Any concerns not
addressed in this guide can be raised via a Github issue or
discussion.

### Code of Conduct

Nomad strives to create an inclusive and welcoming development environment.
Generally, we follow the
[Rust Code of Conduct](https://www.rust-lang.org/policies/code-of-conduct).

This is the _minimum_ expected behavior of our employees and outside
contributors. Violations of this code of conduct should be reported to the team
directly via [j@nomad.xyz](mailto:j@nomad.xyz).

### Repo Layout

This repo is a [yarn workspace](https://yarnpkg.com/features/workspaces). All
packages are located in `packages/`. Generally, packages are intended to
contain a `src/` directory, which is built to `dist/` See [Publishing to npm]
(#publishing-to-npm) for more details on publishing each package to [npm]
(https://www.npmjs.com/settings/nomad-xyz/packages).

Published packages:

- `@nomad-xyz/contracts-core`
- `@nomad-xyz/contracts-router`
- `@nomad-xyz/contracts-bridge`
- `@nomad-xyz/sdk`
- `@nomad-xyz/sdk-bridge`
- `@nomad-xyz/sdk-govern`

Tooling and other unpublished packages:

- `keymaster`
- `local-enviroment`
- `deploy`
- `monitor`

Examples:

- see [examples repo here](https://github.com/nomad-xyz/examples)

### Initial Repo Setup

After cloning the repo, Confirm that you are using yarn2

```
$ yarn -v
```

And install Foundry using the instructions
[here](https://book.getfoundry.sh/getting-started/installation.html) or via
these commands:

```
$ curl -L https://foundry.paradigm.xyz | bash
$ foundryup
```

If needed, reference Foundry's [Troubleshooting Installation](https://github.com/foundry-rs/foundry#troubleshooting-installation) guide to resolve any errors.

Then run the following:

```
$ yarn install
$ yarn build
```

### Common yarn scripts

Packages in this repo follow a standard yarn script template. New packages
should implement these scripts. All of these scripts should work in any
package. Running them from the repo root will run them concurrently in all
packages.

```
$ yarn prettier
$ yarn lint
$ yarn test
$ yarn build
```

### Creating a new typescript package

To create a new package, perform the following steps:

- Make a new directory in `packages/`
- From that new directory, run `yarn init`
- `$ yarn add` any dependencies
  - Common deps include: `ethers`
  - Common dev-deps include: `typescript`, `eslint`, `eslint-config-prettier`
  - Check other `package.json` files for a list :)
- In the newly generated `package.json` do the following:
  - set the standard 4 yarn scripts (usually copied from other packages)
  - set `"main": "dist/index.js",`
  - set `"types": "dist/index.d.ts",`
  - ensure that in-repo deps are specified as `"workspace:^`
- Create a `src/` directory to hold the TS source
- Create a new `tsconfig.json`
  - make sure to set the `"references"` key if you have in-repo deps :)
- Update the `"references"` key in `packages/tsconfig.package.json`
- Copy and review the following files from another package
  - `.gitignore`
  - `.eslintrc.json`
  - `.prettierrc`
  - `.eslintignore`
- Write a `README.md` for your package
- Create a `CHANGELOG.md` for your package

Yes this is a lot, we intend to automate it later :)

### Publishing to npm

Before publishing any package to `npm` perform the following steps:

1. Run `yarn` to ensure the lockfile is up to date
2. Run `yarn lint` to ensure all packages are linted
3. Run `yarn test` to ensure all tests are passing
4. Run `yarn build` to build all the packages
5. Ensure that your package has a sensible `.npmignore`
6. Ensure that the `main` and `types` keys in your package are set correctly
7. Bump the version number in `package.json` (https://semver.org/, ask the team if you're unsure)
8. Commit the above changes to a branch
9. Create a PR and get approval
10. Merge the PR to main
11. **Pull and checkout _latest_ main** and tag the commit (`git tag -s <package-to-release>@<new-package-version> <commit>`)
12. Push tags (`git push --tags`)
13. From the tagged commit, ensure your working tree is clean with `git status`
14. Ensure that you are on the root of the monorepo before publishing. Publishing from the individual package folder will not replace versions with `workspace:^` with the actual versions in the package.json that is uploaded to npm. This will cause errors when you try to install the packages from npm.
15. Publish to npm (run this from the root `yarn <package-to-release> npm publish --access public`)
