import { setup } from './counter'
import './style.css'
import "@wgb5445/aptos-wallet-connect-kit";

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <wallet-connect-button autoConnect></wallet-connect-button>
  <div id="game"></div>
`

setup(document.querySelector<HTMLButtonElement>('#game')!)
