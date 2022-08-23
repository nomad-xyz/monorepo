echo '\033[0;32m' ====== Hello $USER, please wait until I build your images ☕ '\033[0m'

foundryup;
yarn install --immutable-cache;
yarn lint;

for d in packages/contracts-*; do
 echo '\033[0;33m' ====== Building $d '\033[0m';
 pushd $d;
 {
    yarn build && echo '\032[0;31m' ====== Built $d '\033[0m'
 } || {
        echo '\033[0;31m' ====== FAILED $d '\033[0m'
    }
#  popd;
done

echo '\033[0;32m' ====== You are good to go sir! '\033[0m'