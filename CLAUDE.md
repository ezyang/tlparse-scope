# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a TypeScript/Vite web application that provides a JSONL (JSON Lines) viewer for analyzing tlparse raw output files. The application allows users to upload JSONL files or load them from URLs, then displays the data in a structured table format with special handling for PyTorch compilation trace data.

## Development Commands

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production (runs TypeScript compiler then Vite build)  
- `npm run preview` - Preview the production build locally
- `npm test` - Run unit tests with Vitest
- `npm run test:ui` - Run tests with Vitest UI
- `npm run test:e2e` - Run end-to-end tests with Playwright

## Architecture

### Core Components

**JSONLViewer Class** (`src/main.ts`): The main application class that handles:
- File upload (drag/drop and file input)
- URL loading of JSONL files
- JSONL parsing with string table support
- Dynamic table rendering with column filtering
- Special processing for PyTorch dynamo_start events

### JSONL Format Support

The application is designed to handle tlparse JSONL format which includes:
- **String table**: First entry contains a `string_table` array for string interning
- **Common fields**: `frame_id`, `frame_compile_id`, `attempt`, `rank`, `process`, `thread`, `timestamp`, `pathname`, `lineno`, `has_payload`, `payload_filename`
- **Event data**: Each entry has one event key (e.g., `dynamo_start`, `compilation_metrics`) with associated data
- **Stack trace handling**: String indices in stack traces are resolved using the string table

### Column Organization

The table displays data in this structure:
- **frame**: Consolidated display as `{frame_id}/{frame_compile_id}_{attempt}` (attempt omitted if 0)
- **Common fields**: `rank`, `process`, `thread` (always visible)
- **Hidden fields**: `timestamp`, `pathname`, `lineno`, `has_payload`, `payload_filename`, `rank`, `process`, `thread` (shown only when "Show all columns" is checked)
- **event_key**: The name of the event (e.g., "dynamo_start")
- **event_content**: JSON stringified content of the event data

### Testing Structure

- **Unit tests** (`tests/unit/`): Test core data processing logic without DOM dependencies
- **E2E tests** (`tests/e2e/`): Playwright tests for full application workflows
- **Test fixtures** (`tests/fixtures/`): Sample JSONL files for testing

The unit tests focus on the data processing algorithms: string table extraction, interned string replacement, frame ID formatting, event key identification, and HTML escaping. E2E tests verify the complete user workflow from file upload to table display.

## Key Features

- Drag-and-drop file upload
- URL-based JSONL loading
- String table processing for PyTorch trace data
- Dynamic column visibility (hide/show metadata columns)
- Consolidated frame ID display
- JSON content formatting in table cells
- Error handling with auto-hide messages