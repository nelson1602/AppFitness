# AppFitness Design System Specification

Version: 1.0
Status: Active
Last Updated: 2026-07-03

---

# Purpose

This document defines the official Design System for AppFitness.

Its purpose is to ensure visual consistency, usability, accessibility, scalability, and maintainability across every screen, component, and interaction.

Every UI implementation must comply with this specification.

---

# Design Philosophy

The design language follows five principles:

- Simplicity
- Consistency
- Accessibility
- Clarity
- Performance

Every interface should reduce cognitive load.

---

# Design Goals

The application should feel:

Professional

Modern

Medical-grade

Friendly

Trustworthy

Fast

Native

Minimal

Data-driven

---

# Inspiration

The visual language is inspired by:

Material Design 3

Apple Human Interface Guidelines

Google Fit

Whoop

Garmin Connect

Notion

Linear

The design should avoid unnecessary visual complexity.

---

# Design Tokens

Every visual property must originate from design tokens.

Never hardcode:

Colors

Spacing

Typography

Border Radius

Elevation

Animation Duration

Opacity

---

# Color System

Semantic colors only.

Primary

Secondary

Tertiary

Background

Surface

Surface Variant

Primary Container

Success

Warning

Error

Info

Disabled

Outline

Divider

Accent

Never reference raw hex colors inside components.

---

# Typography

Font Family

Inter

Scale

Display

Headline

Title

Body

Label

Caption

Numeric values should use tabular figures whenever possible.

---

# Spacing System

Use an 8-point grid.

Allowed spacing:

4

8

12

16

20

24

32

40

48

56

64

Avoid arbitrary spacing values.

---

# Corner Radius

Use predefined tokens.

Small

Medium

Large

Extra Large

Full

Never hardcode radius values.

---

# Elevation

Elevation should communicate hierarchy.

Levels

0

1

2

3

4

5

Avoid excessive shadows.

---

# Icons

Material Symbols

Outlined by default.

Filled only for selected or active states.

Icons should always communicate meaning.

Avoid decorative icons.

---

# Layout

Every screen follows:

Header

↓

Content

↓

Primary Actions

↓

Secondary Actions

↓

Bottom Navigation (when applicable)

Avoid visual clutter.

---

# Component Hierarchy

Screen

↓

Section

↓

Card

↓

Reusable Component

↓

Primitive

Keep component trees shallow.

---

# Component States

Every interactive component must support:

Default

Hover

Pressed

Focused

Disabled

Loading

Error

Success

Selected

Empty

---

# Buttons

Variants

Primary

Secondary

Tertiary

Outlined

Text

Destructive

Loading

Disabled

Buttons should communicate priority.

---

# Inputs

Support

Validation

Helper Text

Error Text

Success State

Loading

Disabled

Auto Focus

Auto Complete

Never rely solely on color for validation.

---

# Cards

Cards represent logical information groups.

Cards should never become containers for unrelated content.

---

# Lists

Support:

Lazy Loading

Pagination

Pull to Refresh

Empty States

Loading States

Error States

Skeletons

Virtualization

---

# Navigation

Navigation must remain predictable.

Avoid more than three navigation levels.

Deep linking should always work.

---

# Dashboard

Dashboard priorities

Today's Progress

Today's Workout

Today's Nutrition

Recovery

Goals

iCoach Insights

Quick Actions

Recent Activity

Important information appears first.

---

# iCoach UI

Recommendations should clearly indicate:

Priority

Reason

Evidence

Expected Outcome

User Action

Confidence Level

Never present AI suggestions as medical advice.

---

# Charts

Use only when they improve understanding.

Support

Accessibility

Tooltips

Legends

Animations

Responsive Layout

Avoid decorative charts.

---

# Motion Design

Animations should communicate:

State Changes

Navigation

Feedback

Hierarchy

Continuity

Animations must never delay user interaction.

---

# Animation Timing

Fast

Normal

Slow

Use predefined motion tokens.

Avoid arbitrary durations.

---

# Haptics

Use subtle haptic feedback for:

Success

Errors

Confirmation

Important Actions

Avoid excessive vibration.

---

# Empty States

Every empty screen should explain:

Why it is empty

What the user can do next

Primary Action

Secondary Action (optional)

Never display blank screens.

---

# Loading States

Use

Skeletons

Progress Indicators

Optimistic UI where appropriate

Avoid blocking the interface unnecessarily.

---

# Error States

Every error should include:

Clear message

Reason (when appropriate)

Recovery action

Retry option

Never expose technical errors.

---

# Accessibility

Target

WCAG 2.2 AA

Support

Screen Readers

VoiceOver

TalkBack

Dynamic Text

Reduced Motion

High Contrast

Minimum touch target:

44 x 44

Accessibility is mandatory.

---

# Dark Mode

Support

Light Theme

Dark Theme

Future Dynamic Themes

Themes must use semantic tokens.

---

# Responsiveness

Layouts should adapt to:

Phones

Foldables

Tablets

Future Desktop

Avoid fixed dimensions whenever possible.

---

# Images

Images should:

Lazy load

Cache

Maintain aspect ratio

Provide placeholders

Support accessibility labels

---

# Notifications

Notifications should be:

Relevant

Actionable

Respectful

Configurable

Avoid notification fatigue.

---

# Forms

Forms should:

Reduce typing

Support autofill

Persist drafts

Validate instantly

Guide completion

---

# Microinteractions

Use subtle interactions for:

Success

Selection

Progress

Completion

Achievements

Navigation

Never distract the user.

---

# User Experience Principles

Every interaction should answer:

What happened?

Why?

What should I do next?

Users should never feel lost.

---

# Design Consistency

The same action should always produce the same visual response.

Consistency takes priority over novelty.

---

# Performance

Design decisions should never compromise:

Rendering

Battery

Memory

Responsiveness

Animations should remain smooth at 60 FPS.

---

# Anti-Patterns

Never

Hardcode colors

Hardcode spacing

Use inconsistent typography

Mix component styles

Create oversized dialogs

Overuse animations

Hide important actions

Depend on color alone

Ignore accessibility

---

# Design Review Checklist

Every screen must verify:

✓ Design Tokens

✓ Accessibility

✓ Responsive Layout

✓ Consistent Navigation

✓ Proper Hierarchy

✓ Empty States

✓ Loading States

✓ Error States

✓ Dark Mode

✓ Performance

✓ Native Feel

✓ Design System Compliance

---

# AI Instructions

Every AI agent generating UI for AppFitness must strictly follow this Design System.

Never invent new styles when an existing pattern already exists.

Prioritize consistency over creativity.

Every new screen should feel as though it has always been part of the application.