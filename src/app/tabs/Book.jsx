import { Screen, Label, Display } from '../ui.jsx'

// Phase 2 — meeting rooms + studios with the credit allowance.
export default function Book() {
  return (
    <Screen>
      <div className="pt-9 pb-7">
        <Label>Book · By the hour</Label>
        <Display className="mt-4">Rooms &amp; studios.</Display>
      </div>
      <p className="hx-prose">Booking is coming to the app shortly.</p>
    </Screen>
  )
}
