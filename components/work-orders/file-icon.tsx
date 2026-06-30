import {
  RiFile2Line,
  RiFileExcel2Line,
  RiFilePdf2Line,
  RiFilePpt2Line,
  RiFileTextLine,
  RiFileWord2Line,
  RiImageLine,
} from '@remixicon/react'

// Renders a content-type-appropriate file icon (PDF, Word, Excel, etc.).
export function FileIcon({
  contentType,
  className,
}: {
  contentType: string
  className?: string
}) {
  if (contentType.startsWith('image/')) {
    return <RiImageLine className={className} aria-hidden="true" />
  }
  if (contentType === 'application/pdf') {
    return <RiFilePdf2Line className={className} aria-hidden="true" />
  }
  if (contentType.includes('word') || contentType === 'application/msword') {
    return <RiFileWord2Line className={className} aria-hidden="true" />
  }
  if (contentType.includes('sheet') || contentType.includes('excel')) {
    return <RiFileExcel2Line className={className} aria-hidden="true" />
  }
  if (
    contentType.includes('presentation') ||
    contentType.includes('powerpoint')
  ) {
    return <RiFilePpt2Line className={className} aria-hidden="true" />
  }
  if (contentType.startsWith('text/')) {
    return <RiFileTextLine className={className} aria-hidden="true" />
  }
  return <RiFile2Line className={className} aria-hidden="true" />
}
