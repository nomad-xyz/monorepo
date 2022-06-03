import { pconfig } from "./configs";
import { Keymaster } from "./context";


(async () => {
    const ctx = (new Keymaster(pconfig)).init();

    // await ctx.checkAllNetworks();
    await ctx.reportLazyAllNetworks();
})();




