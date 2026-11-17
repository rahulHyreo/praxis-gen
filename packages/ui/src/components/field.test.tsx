import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
} from "./field"
import { Input } from "./input"

describe("Field", () => {
  it("renders without crashing", () => {
    render(<Field>content</Field>)
    expect(screen.getByRole("group")).toBeInTheDocument()
  })

  it("has data-slot attribute", () => {
    render(<Field>content</Field>)
    expect(screen.getByRole("group")).toHaveAttribute("data-slot", "field")
  })

  it("applies vertical orientation by default", () => {
    render(<Field>content</Field>)
    expect(screen.getByRole("group")).toHaveAttribute(
      "data-orientation",
      "vertical"
    )
  })

  it("applies horizontal orientation", () => {
    render(<Field orientation="horizontal">content</Field>)
    expect(screen.getByRole("group")).toHaveAttribute(
      "data-orientation",
      "horizontal"
    )
  })

  it("applies responsive orientation", () => {
    render(<Field orientation="responsive">content</Field>)
    expect(screen.getByRole("group")).toHaveAttribute(
      "data-orientation",
      "responsive"
    )
  })
})

describe("FieldLabel", () => {
  it("renders without crashing", () => {
    render(<FieldLabel>Email</FieldLabel>)
    expect(screen.getByText("Email")).toBeInTheDocument()
  })

  it("has data-slot=field-label", () => {
    render(<FieldLabel>Email</FieldLabel>)
    expect(screen.getByText("Email")).toHaveAttribute(
      "data-slot",
      "field-label"
    )
  })
})

describe("FieldDescription", () => {
  it("renders without crashing", () => {
    render(<FieldDescription>A helpful hint.</FieldDescription>)
    expect(screen.getByText("A helpful hint.")).toBeInTheDocument()
  })

  it("has data-slot=field-description", () => {
    render(<FieldDescription>A helpful hint.</FieldDescription>)
    expect(screen.getByText("A helpful hint.")).toHaveAttribute(
      "data-slot",
      "field-description"
    )
  })
})

describe("FieldError", () => {
  it("renders nothing when no children and no errors", () => {
    const { container } = render(<FieldError />)
    expect(container.firstChild).toBeNull()
  })

  it("renders children when provided", () => {
    render(<FieldError>Custom error</FieldError>)
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.getByText("Custom error")).toBeInTheDocument()
  })

  it("renders single error message from errors array", () => {
    render(<FieldError errors={[{ message: "Required field" }]} />)
    expect(screen.getByText("Required field")).toBeInTheDocument()
  })

  it("renders multiple error messages as list", () => {
    render(
      <FieldError
        errors={[{ message: "Too short" }, { message: "Invalid format" }]}
      />
    )
    expect(screen.getByText("Too short")).toBeInTheDocument()
    expect(screen.getByText("Invalid format")).toBeInTheDocument()
  })

  it("deduplicates identical error messages", () => {
    render(
      <FieldError errors={[{ message: "Required" }, { message: "Required" }]} />
    )
    const errors = screen.getAllByText("Required")
    expect(errors).toHaveLength(1)
  })

  it("has role=alert", () => {
    render(<FieldError>Error!</FieldError>)
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })
})

describe("FieldGroup", () => {
  it("renders without crashing", () => {
    render(<FieldGroup>group</FieldGroup>)
    expect(screen.getByText("group")).toHaveAttribute(
      "data-slot",
      "field-group"
    )
  })
})

describe("FieldSet", () => {
  it("renders without crashing", () => {
    const { container } = render(<FieldSet />)
    expect(
      container.querySelector('[data-slot="field-set"]')
    ).toBeInTheDocument()
    expect(container.querySelector("fieldset")).toBeInTheDocument()
  })
})

describe("FieldLegend", () => {
  it("renders without crashing", () => {
    render(
      <fieldset>
        <FieldLegend>Personal Info</FieldLegend>
      </fieldset>
    )
    expect(screen.getByText("Personal Info")).toBeInTheDocument()
  })

  it("applies legend variant by default", () => {
    render(
      <fieldset>
        <FieldLegend>Legend text</FieldLegend>
      </fieldset>
    )
    expect(screen.getByText("Legend text")).toHaveAttribute(
      "data-variant",
      "legend"
    )
  })

  it("applies label variant", () => {
    render(
      <fieldset>
        <FieldLegend variant="label">Label text</FieldLegend>
      </fieldset>
    )
    expect(screen.getByText("Label text")).toHaveAttribute(
      "data-variant",
      "label"
    )
  })
})

describe("FieldSeparator", () => {
  it("renders without crashing", () => {
    render(<FieldSeparator />)
    expect(
      document.querySelector('[data-slot="field-separator"]')
    ).toBeInTheDocument()
  })

  it("renders children content", () => {
    render(<FieldSeparator>OR</FieldSeparator>)
    expect(screen.getByText("OR")).toBeInTheDocument()
  })
})

describe("FieldContent", () => {
  it("renders without crashing", () => {
    render(<FieldContent>content area</FieldContent>)
    expect(screen.getByText("content area")).toHaveAttribute(
      "data-slot",
      "field-content"
    )
  })
})

describe("FieldTitle", () => {
  it("renders without crashing", () => {
    render(<FieldTitle>Title</FieldTitle>)
    expect(screen.getByText("Title")).toBeInTheDocument()
  })
})

describe("Field composition", () => {
  it("renders a complete field with label and input", () => {
    render(
      <Field>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input id="email" type="email" placeholder="you@example.com" />
        <FieldDescription>We won't share your email.</FieldDescription>
      </Field>
    )
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument()
    expect(screen.getByText("We won't share your email.")).toBeInTheDocument()
  })

  it("shows validation error", () => {
    render(
      <Field>
        <FieldLabel>Name</FieldLabel>
        <Input />
        <FieldError errors={[{ message: "Name is required" }]} />
      </Field>
    )
    expect(screen.getByText("Name is required")).toBeInTheDocument()
  })
})
