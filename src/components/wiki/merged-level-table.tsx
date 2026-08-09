'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { WikiTable, WikiTableFrame } from '@/components/wiki/wiki-table'
import { getAdjacentSpans, getWidestTableValue } from '@/components/wiki/wiki-detail-utils'
import { cn } from '@/lib/utils'

/**
 * 测量 sticky 表头的实际高度, 写入 <table> 的 --table-header-h CSS 变量。
 * 合并值 span 用 top-[var(--table-header-h,2.5rem)] 钉在表头正下方: 表头高度随列宽
 * 换行变化 (17 列窄表头可达 176px), 写死 top-10 (40px) 会把钉住的数值藏到不透明
 * 表头后面。ResizeObserver 覆盖窗口缩放/字体加载引起的表头高度变化;
 * jsdom 无布局 (offsetHeight=0) 或没有 ResizeObserver 时保持 CSS 回退值。
 */
function useStickyTableHeaderHeight() {
  const tableRef = useRef<HTMLTableElement>(null)
  const headerRef = useRef<HTMLTableSectionElement>(null)

  useEffect(() => {
    const table = tableRef.current
    const header = headerRef.current
    if (!table || !header) return
    const update = () => {
      const height = header.offsetHeight
      if (height > 0) table.style.setProperty('--table-header-h', `${height}px`)
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  return { tableRef, headerRef }
}

/**
 * 列宽锁定: min/max-width = 恰好内容宽 (标定行 td 用等宽字体, ch 单位准确)。
 * auto layout 中列宽 = 内容下限 + 按 max-content 权重的富余分配, 展开后行数变化
 * 会让分配漂移 ±1-4px; max-width 锁死可增长性后列宽只由内容下限决定, 折叠/展开
 * 恒定。锁定值 ≤ 内容下限的列由下限接管 (列宽不变); 表头/内容更宽的列同样由
 * 内容决定, 锁定只负责消除分配漂移。
 */
function lockColumnWidth(text: string): CSSProperties {
  const width = `calc(${text.length}ch + 16px)`
  return { minWidth: width, maxWidth: width }
}

/** 合并值在 sticky 表头下方钉住 (配合 useStickyTableHeaderHeight 的 --table-header-h)。 */
function MergedValue({ value, span }: { value: ReactNode; span: number }) {
  return (
    <span className={cn('inline-flex min-h-10 items-center px-2 py-2', span > 1 && 'sticky top-[var(--table-header-h,2.5rem)]')}>
      {value}
    </span>
  )
}

function LevelToggle({
  showAll,
  onToggle,
  collapseLabel,
  expandLabel,
}: {
  showAll: boolean
  onToggle: () => void
  collapseLabel: string
  expandLabel: string
}) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onToggle}>
      {showAll ? <ChevronUp data-icon="inline-start" /> : <ChevronDown data-icon="inline-start" />}
      {showAll ? collapseLabel : expandLabel}
    </Button>
  )
}

const DEFAULT_HEADER_CLASS = 'whitespace-normal break-words text-center leading-tight'
const STICKY_HEADER_CLASS = 'sticky left-0 z-30 bg-card'
const STICKY_CELL_CLASS = 'sticky left-0 z-10 bg-card'
const MERGED_CELL_CLASS = 'relative p-0 text-center align-top'

export interface MergedLevelColumn<Row> {
  key: string
  header: ReactNode
  /** 单元格取值: 合并判定 + 标定行文本 (应为最终展示文本)。 */
  value: (row: Row) => string
  /** 自定义单元格渲染 (如材料列), 默认渲染 value 文本。 */
  render?: (row: Row) => ReactNode
  /** 单元格类名 (字体/对齐), 首列自动叠加 sticky, 合并格自动叠加相对定位。 */
  cellClassName?: string
  /** 标定行单元格类名, 默认复用 cellClassName。 */
  sizingClassName?: string
  /** 表头类名, 默认 whitespace-normal break-words text-center leading-tight。 */
  headerClassName?: string
  /** 首列 sticky (固定在滚动容器左侧)。 */
  sticky?: boolean
  /** 参与列宽锁定, 默认 true; 材料列等宽度由内容决定的列设为 false。 */
  lock?: boolean
  /** 相邻相同值合并 (rowSpan), 默认 true; 材料列设为 false。 */
  merge?: boolean
  /** 单元格 title (完整精度), 仅在需要时返回。 */
  title?: (row: Row) => string | undefined
}

export interface MergedLevelTableProps<Row> {
  columns: MergedLevelColumn<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  /** 折叠状态下显示的行 (最高等级 / 末级等)。 */
  collapsedRows: (rows: Row[]) => Row[]
  scrollClassName?: string
  frameClassName?: string
  collapseLabel: string
  expandLabel: string
}

/**
 * 三张等级类表格 (干员等级 / 干员技能 / 武器等级) 的统一实现。
 * 共享: 滚动容器 + 展开按钮、sticky 表头/首列、合并值钉住 (--table-header-h)、
 * 宽度标定行 (折叠/展开列宽恒定)、列宽锁定 (消除 auto layout 富余分配漂移)。
 */
export function MergedLevelTable<Row>({
  columns,
  rows,
  rowKey,
  collapsedRows,
  scrollClassName,
  frameClassName,
  collapseLabel,
  expandLabel,
}: MergedLevelTableProps<Row>) {
  const [showAll, setShowAll] = useState(false)
  const { tableRef, headerRef } = useStickyTableHeaderHeight()
  const visibleRows = showAll ? rows : collapsedRows(rows)

  const sizingValues = useMemo(
    () => columns.map((column) => getWidestTableValue(rows.map(column.value))),
    [columns, rows],
  )
  const spans = columns.map((column) => (column.merge === false ? null : getAdjacentSpans(visibleRows.map(column.value))))

  return (
    <WikiTableFrame
      scrollClassName={scrollClassName}
      className={frameClassName}
      footer={<LevelToggle showAll={showAll} onToggle={() => setShowAll((value) => !value)} collapseLabel={collapseLabel} expandLabel={expandLabel} />}
    >
      <WikiTable ref={tableRef} className="min-w-full">
        <TableHeader ref={headerRef} className="sticky top-0 z-20 bg-card shadow-[0_1px_0_0_rgba(0,0,0,0.08)]">
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(DEFAULT_HEADER_CLASS, column.headerClassName, column.sticky && STICKY_HEADER_CLASS)}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* 宽度标定行: 携带每列最宽展示值, 折叠/展开共用同一组列宽;
              列宽锁定 (min/max-width = 恰好内容宽) 消除 auto layout 的富余分配漂移。 */}
          <TableRow aria-hidden className="collapse">
            {columns.map((column, index) => (
              <TableCell
                key={column.key}
                className={cn(column.sizingClassName ?? column.cellClassName)}
                style={column.lock === false || column.sticky ? undefined : lockColumnWidth(sizingValues[index])}
              >
                {sizingValues[index]}
              </TableCell>
            ))}
          </TableRow>
          {visibleRows.map((row, rowIndex) => (
            <TableRow key={rowKey(row)}>
              {columns.map((column, columnIndex) => {
                const value = column.render ? column.render(row) : column.value(row)
                if (column.merge === false) {
                  return (
                    <TableCell key={column.key} className={cn(column.sticky && STICKY_CELL_CLASS, column.cellClassName)}>
                      {value}
                    </TableCell>
                  )
                }
                const span = spans[columnIndex]?.[rowIndex] ?? 0
                if (span === 0) return null
                if (column.sticky) {
                  return (
                    <TableCell
                      key={column.key}
                      className={cn(STICKY_CELL_CLASS, column.cellClassName)}
                      style={{ minWidth: `${sizingValues[columnIndex].length + 1}ch` }}
                    >
                      {value}
                    </TableCell>
                  )
                }
                return (
                  <TableCell
                    key={column.key}
                    rowSpan={span}
                    title={column.title?.(row)}
                    className={cn(MERGED_CELL_CLASS, column.cellClassName)}
                  >
                    <MergedValue value={value} span={span} />
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </WikiTable>
    </WikiTableFrame>
  )
}

export default MergedLevelTable
