# Nomad Monitor
Tool used to observe the state of a Nomad contract deployment and export actionable Prometheus metrics. 

# Release Workflow
This tool needs to be re-released whenever underlying libraries (like `nomad-sdk`) are updated. 

Do the following: 
- Update the pin in `package.json`
- `npm i` to ensure packages install successfully 
- Sanity check by running it locally `npm run monitor-once`
- Commit changes and PR
- Cut a release via `npm run docker-release` -- This will result in a new image with the current git sha [here](https://console.cloud.google.com/gcr/images/nomad-xyz/global/nomad-monitor)