import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'

export function SixDigitOtp({
  id,
  value,
  onChange,
  invalid,
  autoFocus,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  autoFocus?: boolean
}) {
  return (
    <InputOTP
      id={id}
      maxLength={6}
      value={value}
      onChange={onChange}
      autoFocus={autoFocus}
      aria-invalid={invalid ? true : undefined}
    >
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  )
}
