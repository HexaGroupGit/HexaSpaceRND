import { Children, isValidElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

function textOf(children) {
  return Children.toArray(children).map((child) => isValidElement(child) ? textOf(child.props.children) : String(child)).join('')
}

function readOptions(children, group = '', groupDisabled = false) {
  const result = []
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === 'option') {
      const label = textOf(child.props.children)
      result.push({ value: String(child.props.value ?? label), label, group,
        disabled: groupDisabled || child.props.disabled,
        search: `${group} ${label} ${child.props['data-search'] || ''}`.toLocaleLowerCase() })
    } else {
      result.push(...readOptions(child.props.children, child.type === 'optgroup' ? child.props.label : group, groupDisabled || child.props.disabled))
    }
  })
  return result
}

// A searchable replacement for single-value record selects. Existing options,
// optgroups, IDs and change handlers remain the source of truth.
export default function SearchSelect({ children, value, onChange, className = '', disabled, required,
  name, id, placeholder, onFocus, onBlur, ...inputProps }) {
  const generatedId = useId()
  const inputId = id || generatedId
  const listId = `${inputId}-options`
  const input = useRef(null)
  const list = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const [invalid, setInvalid] = useState(false)
  const [position, setPosition] = useState(null)
  const options = useMemo(() => readOptions(children), [children])
  const selected = options.find((option) => option.value === String(value ?? ''))
  const empty = options.find((option) => option.value === '')
  const search = query.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
  const matches = options.filter((option) => option.search.replace(/\s+/g, ' ').includes(search))
  const isOpen = open && !disabled

  useEffect(() => { setInvalid(false) }, [value])
  useEffect(() => { if (disabled) setOpen(false) }, [disabled])
  useLayoutEffect(() => {
    if (!isOpen) return
    function place() {
      const rect = input.current.getBoundingClientRect()
      const viewport = window.visualViewport
      const top = viewport?.offsetTop || 0
      const bottom = top + (viewport?.height || window.innerHeight)
      const below = bottom - rect.bottom - 8
      const above = rect.top - top - 8
      const upwards = below < 180 && above > below
      const maxHeight = Math.max(60, Math.min(280, upwards ? above : below))
      setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
        width: Math.min(rect.width, window.innerWidth - 16), maxHeight,
        top: upwards ? undefined : rect.bottom + 4,
        bottom: upwards ? window.innerHeight - rect.top + 4 : undefined })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    window.visualViewport?.addEventListener('resize', place)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      window.visualViewport?.removeEventListener('resize', place)
    }
  }, [isOpen])
  useEffect(() => {
    if (isOpen && active >= 0) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, isOpen])

  function begin() {
    if (disabled || open) return
    setQuery('')
    setActive(-1)
    setOpen(true)
  }
  function choose(option) {
    if (!option || option.disabled) return
    const target = { value: option.value, name, id: inputId }
    onChange?.({ target, currentTarget: target })
    setInvalid(false)
    setOpen(false)
    setQuery('')
    requestAnimationFrame(() => input.current?.select())
  }
  function keyDown(event) {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      input.current?.select()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isOpen) { begin(); return }
      const direction = event.key === 'ArrowDown' ? 1 : -1
      let next = active < 0 ? (direction === 1 ? 0 : matches.length - 1) : active + direction
      while (next >= 0 && next < matches.length && matches[next].disabled) next += direction
      if (next >= 0 && next < matches.length) setActive(next)
    } else if (event.key === 'Enter' && isOpen) {
      event.preventDefault()
      choose(matches[active] || matches.find((option) => !option.disabled))
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return <>
    <input {...inputProps} ref={input} id={inputId} type="text" role="combobox"
      className={className} style={{ cursor: 'text', ...inputProps.style }}
      size={Math.min(40, Math.max(20, (selected?.label || empty?.label || '').length))}
      disabled={disabled} autoComplete="off" spellCheck={false}
      value={isOpen ? query : (selected?.value ? selected.label : '')}
      placeholder={placeholder || (empty?.label ? `${empty.label} — type to search` : 'Type to search…')}
      aria-expanded={isOpen} aria-controls={isOpen ? listId : undefined} aria-autocomplete="list"
      aria-required={required || undefined} aria-invalid={invalid || inputProps['aria-invalid']}
      aria-activedescendant={isOpen && matches[active] ? `${listId}-${active}` : undefined}
      onFocus={(event) => { begin(); onFocus?.(event) }} onClick={begin}
      onBlur={(event) => { setOpen(false); setQuery(''); onBlur?.(event) }}
      onChange={(event) => { setQuery(event.target.value); setActive(-1); setOpen(true) }} onKeyDown={keyDown} />
    {/* Retain native required-field validation and form submission of record IDs. */}
    <select value={value ?? ''} name={name} required={required} disabled={disabled} tabIndex={-1}
      aria-hidden="true" className="sr-only" onChange={() => {}}
      onInvalid={(event) => { event.preventDefault(); setInvalid(true); input.current?.focus(); begin() }}>
      {!empty && <option value="" />}{children}
    </select>
    {isOpen && position && createPortal(
      <div ref={list} id={listId} role="listbox" aria-label={inputProps['aria-label'] || 'Search results'}
        className="fixed overflow-y-auto rounded-md border border-gray-200 bg-white text-gray-900 shadow-xl text-sm"
        style={{ ...position, zIndex: 100000 }} onMouseDown={(event) => event.preventDefault()}>
        {invalid && <div role="alert" className="px-3 py-2 text-red-600">Choose an option from the list.</div>}
        {matches.length === 0 && <div role="status" className="px-3 py-3 text-gray-500">No matches found. Try another search.</div>}
        {matches.map((option, index) => <div key={`${option.group}:${option.value}:${index}`}>
          {option.group && option.group !== matches[index - 1]?.group && <div className="px-3 pt-3 pb-1 text-xs font-semibold text-gray-500">{option.group}</div>}
          <div id={`${listId}-${index}`} role="option" aria-selected={option.value === String(value ?? '')}
            aria-disabled={option.disabled || undefined} data-index={index}
            className={`px-3 py-2 whitespace-normal ${option.disabled ? 'text-gray-400 cursor-not-allowed' : 'cursor-pointer'} ${index === active ? 'bg-blue-100' : option.value === String(value ?? '') ? 'bg-gray-100 font-medium' : ''}`}
            onMouseMove={() => { if (!option.disabled && active !== index) setActive(index) }}
            onClick={() => choose(option)}>{option.label || 'None'}</div>
        </div>)}
      </div>, document.body)}
  </>
}
