import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "./table"

describe("Table", () => {
  it("renders without crashing", () => {
    render(<Table />)
    expect(screen.getByRole("table")).toBeInTheDocument()
  })

  it("has data-slot attribute on the table element", () => {
    render(<Table />)
    expect(screen.getByRole("table")).toHaveAttribute("data-slot", "table")
  })

  it("wraps table in a container div", () => {
    const { container } = render(<Table />)
    const wrapper = container.querySelector('[data-slot="table-container"]')
    expect(wrapper).toBeInTheDocument()
  })

  it("applies extra className to table", () => {
    render(<Table className="my-table" />)
    expect(screen.getByRole("table")).toHaveClass("my-table")
  })
})

describe("TableHeader", () => {
  it("renders without crashing", () => {
    render(
      <table>
        <TableHeader>
          <tr>
            <th>Head</th>
          </tr>
        </TableHeader>
      </table>
    )
    const el = document.querySelector('[data-slot="table-header"]')
    expect(el).toBeInTheDocument()
    expect(el?.tagName).toBe("THEAD")
  })
})

describe("TableBody", () => {
  it("renders without crashing", () => {
    render(
      <table>
        <TableBody>
          <tr>
            <td>Body</td>
          </tr>
        </TableBody>
      </table>
    )
    const el = document.querySelector('[data-slot="table-body"]')
    expect(el?.tagName).toBe("TBODY")
  })
})

describe("TableFooter", () => {
  it("renders without crashing", () => {
    render(
      <table>
        <TableFooter>
          <tr>
            <td>Footer</td>
          </tr>
        </TableFooter>
      </table>
    )
    const el = document.querySelector('[data-slot="table-footer"]')
    expect(el?.tagName).toBe("TFOOT")
  })
})

describe("TableRow", () => {
  it("renders without crashing", () => {
    render(
      <table>
        <tbody>
          <TableRow>
            <td>Row</td>
          </TableRow>
        </tbody>
      </table>
    )
    const el = document.querySelector('[data-slot="table-row"]')
    expect(el?.tagName).toBe("TR")
  })
})

describe("TableHead", () => {
  it("renders without crashing", () => {
    render(
      <table>
        <thead>
          <tr>
            <TableHead>Column</TableHead>
          </tr>
        </thead>
      </table>
    )
    expect(
      screen.getByRole("columnheader", { name: "Column" })
    ).toBeInTheDocument()
  })
})

describe("TableCell", () => {
  it("renders without crashing", () => {
    render(
      <table>
        <tbody>
          <tr>
            <TableCell>Cell value</TableCell>
          </tr>
        </tbody>
      </table>
    )
    expect(screen.getByRole("cell", { name: "Cell value" })).toBeInTheDocument()
  })
})

describe("TableCaption", () => {
  it("renders without crashing", () => {
    render(
      <table>
        <TableCaption>My caption</TableCaption>
      </table>
    )
    expect(screen.getByText("My caption")).toBeInTheDocument()
  })
})

describe("Table composition", () => {
  it("renders a complete table structure", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Age</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alice</TableCell>
            <TableCell>30</TableCell>
          </TableRow>
        </TableBody>
        <TableCaption>Users</TableCaption>
      </Table>
    )
    expect(screen.getByRole("table")).toBeInTheDocument()
    expect(
      screen.getByRole("columnheader", { name: "Name" })
    ).toBeInTheDocument()
    expect(screen.getByRole("cell", { name: "Alice" })).toBeInTheDocument()
    expect(screen.getByText("Users")).toBeInTheDocument()
  })
})
