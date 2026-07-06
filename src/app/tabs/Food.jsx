import { Screen, Label, Display } from '../ui.jsx'

// Phase 3 — Seoul Bakery partner ordering, delivered to your door.
export default function Food() {
  return (
    <Screen>
      <div className="pt-9 pb-7">
        <Label>Seoul Bakery · Downstairs</Label>
        <Display className="mt-4">Fresh, to your door.</Display>
      </div>
      <p className="hx-prose">Ordering is coming to the app shortly.</p>
    </Screen>
  )
}
