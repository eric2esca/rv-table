// src/components/DataTable.tsx
import React, { useEffect, useState, useMemo, useRef, UIEvent } from 'react';
import axios from 'axios';
import styled from 'styled-components';
import {
	Table,
	Column,
	AutoSizer,
	TableHeaderProps,
	Index,
} from 'react-virtualized';
import {
	DragDropContext,
	Droppable,
	Draggable,
	DropResult,
} from 'react-beautiful-dnd';
import 'react-virtualized/styles.css';

//
// Type Definitions
//
interface User {
	name: {
		first: string;
		last: string;
	};
	email: string;
	phone: string;
}

interface ColumnConfig {
	label: string;
	dataKey: string;
	width: number;
	isVisible: boolean;
	cellRenderer?: (props: any) => JSX.Element | string;
}

//
// Styled Components
//
const TableContainer = styled.div`
	width: 100%;
	height: 600px;
	margin: 20px auto;
	border: 1px solid #ddd;
`;

const ControlsContainer = styled.div`
	margin: 20px;
`;

//
// Main DataTable Component
//
const DataTable: React.FC = () => {
	// ----- Data and Paging States -----
	// We use "minPage" and "maxPage" to keep track of which pages are currently loaded.
	// (For this demo, we start at page 1. In a real-world scenario you might start in the middle.)
	const [users, setUsers] = useState<User[]>([]);
	const [minPage, setMinPage] = useState<number>(1);
	const [maxPage, setMaxPage] = useState<number>(1);
	const [loading, setLoading] = useState<boolean>(false);

	// We'll use these constants for our paging/infinite scroll
	const pageSize = 50;
	const rowHeight = 40;

	// ----- Sorting State -----
	const [sortBy, setSortBy] = useState<string>('');
	const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC');

	// ----- Column Configuration State -----
	const [columns, setColumns] = useState<ColumnConfig[]>([
		{
			label: 'Name',
			dataKey: 'name',
			width: 200,
			isVisible: true,
			cellRenderer: ({ rowData }: any) =>
				rowData && rowData.name
					? `${rowData.name.first} ${rowData.name.last}`
					: 'Loading...',
		},
		{
			label: 'Email',
			dataKey: 'email',
			width: 300,
			isVisible: true,
			cellRenderer: ({ rowData }: any) =>
				rowData && rowData.email ? rowData.email : 'Loading...',
		},
		{
			label: 'Phone',
			dataKey: 'phone',
			width: 200,
			isVisible: true,
			cellRenderer: ({ rowData }: any) =>
				rowData && rowData.phone ? rowData.phone : 'Loading...',
		},
	]);

	// ----- Filtering State -----
	const [filters, setFilters] = useState<{ [key: string]: string }>({});

	// ----- Controlled Scroll Position -----
	// We use this state to control the scroll offset (especially when prepending new rows)
	const [scrollTop, setScrollTop] = useState<number>(0);

	// A ref to the Table component so we can (if needed) adjust scroll position manually.
	const tableRef = useRef<Table>(null);

	// ----- Helper: Sort the list of users -----
	const sortList = (
		list: User[],
		sortBy: string,
		sortDirection: 'ASC' | 'DESC'
	): User[] => {
		return [...list].sort((a, b) => {
			let aValue: string, bValue: string;
			if (sortBy === 'name') {
				aValue = a.name.first;
				bValue = b.name.first;
			} else if (sortBy === 'email' || sortBy === 'phone') {
				aValue = a[sortBy];
				bValue = b[sortBy];
			} else {
				return 0;
			}
			if (aValue < bValue) return sortDirection === 'ASC' ? -1 : 1;
			if (aValue > bValue) return sortDirection === 'ASC' ? 1 : -1;
			return 0;
		});
	};

	// ----- Initial Data Fetch -----
	// We load page 1 on mount.
	useEffect(() => {
		const fetchData = async (page: number) => {
			setLoading(true);
			try {
				const response = await axios.get(
					`https://randomuser.me/api/?results=${pageSize}&page=${page}`
				);
				const fetchedUsers = response.data.results;
				setUsers(fetchedUsers);
				setMinPage(page);
				setMaxPage(page);
			} catch (error) {
				console.error('Error fetching initial data:', error);
			} finally {
				setLoading(false);
			}
		};
		fetchData(1);
	}, []);

	// ----- Filtering: derive a filtered list from our users and active filters -----
	const filteredUsers = useMemo(() => {
		return users.filter((user) => {
			return Object.entries(filters).every(([key, filterValue]) => {
				if (!filterValue) return true;
				if (key === 'name') {
					const fullName = `${user.name.first} ${user.name.last}`.toLowerCase();
					return fullName.includes(filterValue.toLowerCase());
				}
				return user[key].toLowerCase().includes(filterValue.toLowerCase());
			});
		});
	}, [users, filters]);

	// ----- Upward & Downward Loading Functions -----
	// When scrolling near the top, load previous (earlier) page and prepend.
	const loadMoreRowsUpward = async () => {
		// For this demo, we stop at page 1.
		if (minPage <= 1 || loading) return;
		setLoading(true);
		const newPage = minPage - 1;
		try {
			const response = await axios.get(
				`https://randomuser.me/api/?results=${pageSize}&page=${newPage}`
			);
			const newUsers: User[] = response.data.results;
			setUsers((prev) => [...newUsers, ...prev]);
			setMinPage(newPage);
			// Adjust scrollTop so that the content appears to remain in place.
			setScrollTop((prev) => prev + newUsers.length * rowHeight);
		} catch (error) {
			console.error('Error loading upward rows:', error);
		} finally {
			setLoading(false);
		}
	};

	// When scrolling near the bottom, load next page and append.
	const loadMoreRowsDownward = async () => {
		if (loading) return;
		setLoading(true);
		const newPage = maxPage + 1;
		try {
			const response = await axios.get(
				`https://randomuser.me/api/?results=${pageSize}&page=${newPage}`
			);
			const newUsers: User[] = response.data.results;
			let combinedUsers = [...users, ...newUsers];
			if (sortBy) {
				combinedUsers = sortList(combinedUsers, sortBy, sortDirection);
			}
			setUsers(combinedUsers);
			setMaxPage(newPage);
		} catch (error) {
			console.error('Error loading downward rows:', error);
		} finally {
			setLoading(false);
		}
	};

	// ----- Custom Scroll Handler for Both Directions -----
	const handleTableScroll = ({
		scrollTop: newScrollTop,
		clientHeight,
		scrollHeight,
	}: {
		scrollTop: number;
		clientHeight: number;
		scrollHeight: number;
	}) => {
		// Update our controlled scroll position.
		setScrollTop(newScrollTop);

		const threshold = 50; // pixels
		if (newScrollTop < threshold && minPage > 1 && !loading) {
			// Near top – load upward rows.
			loadMoreRowsUpward();
		}
		if (newScrollTop + clientHeight > scrollHeight - threshold && !loading) {
			// Near bottom – load downward rows.
			loadMoreRowsDownward();
		}
	};

	// ----- Sorting Handler -----
	const handleSort = ({
		sortBy: newSortBy,
		sortDirection: newSortDirection,
	}: {
		sortBy: string;
		sortDirection: 'ASC' | 'DESC';
	}) => {
		setSortBy(newSortBy);
		setSortDirection(newSortDirection);
		const sortedUsers = sortList(users, newSortBy, newSortDirection);
		setUsers(sortedUsers);
	};

	// ----- Drag & Drop Handler for Column Reordering -----
	const handleDragEnd = (result: DropResult) => {
		if (!result.destination) return;
		const newColumns = Array.from(columns);
		const [removed] = newColumns.splice(result.source.index, 1);
		newColumns.splice(result.destination.index, 0, removed);
		setColumns(newColumns);
	};

	// ----- Toggle Column Visibility -----
	const toggleColumnVisibility = (dataKey: string) => {
		setColumns((prev) =>
			prev.map((col) =>
				col.dataKey === dataKey ? { ...col, isVisible: !col.isVisible } : col
			)
		);
	};

	// ----- Filter Change Handler -----
	const handleFilterChange = (dataKey: string, value: string) => {
		setFilters((prev) => ({ ...prev, [dataKey]: value }));
	};

	// ----- Custom Header Renderer using Drag & Drop -----
	// We wrap header cells in react-beautiful-dnd components.
	const headerRowRenderer = (headerProps: TableHeaderProps) => {
		const { className, style } = headerProps;
		const visibleColumns = columns.filter((col) => col.isVisible);
		return (
			<DragDropContext onDragEnd={handleDragEnd}>
				<Droppable
					droppableId='droppable'
					direction='horizontal'
				>
					{(provided) => (
						<div
							className={className}
							style={{ ...style, display: 'flex' }}
							ref={provided.innerRef}
							{...provided.droppableProps}
						>
							{visibleColumns.map((column, index) => (
								<Draggable
									key={column.dataKey}
									draggableId={column.dataKey}
									index={index}
								>
									{(provided) => (
										<div
											ref={provided.innerRef}
											{...provided.draggableProps}
											{...provided.dragHandleProps}
											style={{
												...provided.draggableProps.style,
												width: column.width,
												padding: '5px 10px',
												borderRight: '1px solid #ddd',
												boxSizing: 'border-box',
												textAlign: 'left',
												backgroundColor: '#f7f7f7',
												cursor: 'move',
											}}
										>
											{column.label}
										</div>
									)}
								</Draggable>
							))}
							{provided.placeholder}
						</div>
					)}
				</Droppable>
			</DragDropContext>
		);
	};

	// ----- CSV Export Handler -----
	const exportToCSV = () => {
		const visibleColumns = columns.filter((col) => col.isVisible);
		const header = visibleColumns.map((col) => col.label).join(',');
		const csvRows = filteredUsers.map((user) => {
			return visibleColumns
				.map((col) => {
					if (col.dataKey === 'name') {
						return `"${user.name.first} ${user.name.last}"`;
					} else {
						return `"${user[col.dataKey]}"`;
					}
				})
				.join(',');
		});
		const csvString = [header, ...csvRows].join('\n');
		const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.setAttribute('href', url);
		link.setAttribute('download', 'export.csv');
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	// ----- rowGetter for the Table -----
	const rowGetter = ({ index }: Index): User | {} => {
		if (index < filteredUsers.length) {
			return filteredUsers[index];
		}
		return {};
	};

	return (
		<>
			{/* Controls: Column visibility toggles, filters, and CSV export */}
			<ControlsContainer>
				<div>
					<strong>Toggle Column Visibility:</strong>
					{columns.map((col) => (
						<label
							key={col.dataKey}
							style={{ marginLeft: '10px' }}
						>
							<input
								type='checkbox'
								checked={col.isVisible}
								onChange={() => toggleColumnVisibility(col.dataKey)}
							/>
							{col.label}
						</label>
					))}
				</div>
				<div style={{ marginTop: '10px' }}>
					<strong>Filters:</strong>
					{columns
						.filter((col) => col.isVisible)
						.map((col) => (
							<label
								key={col.dataKey}
								style={{ marginLeft: '10px' }}
							>
								{col.label}:
								<input
									type='text'
									value={filters[col.dataKey] || ''}
									onChange={(e) =>
										handleFilterChange(col.dataKey, e.target.value)
									}
								/>
							</label>
						))}
				</div>
				<button
					style={{ marginTop: '10px' }}
					onClick={exportToCSV}
				>
					Export CSV
				</button>
			</ControlsContainer>

			{/* The Table */}
			<TableContainer>
				{loading && <div style={{ padding: '10px' }}>Loading...</div>}
				<AutoSizer>
					{({ height, width }) => (
						<Table
							ref={tableRef}
							width={width}
							height={height}
							headerHeight={50}
							rowHeight={rowHeight}
							rowCount={filteredUsers.length}
							rowGetter={rowGetter}
							// Pass our custom scroll handler and controlled scrollTop value:
							scrollTop={scrollTop}
							onScroll={({ scrollTop, clientHeight, scrollHeight }) =>
								handleTableScroll({ scrollTop, clientHeight, scrollHeight })
							}
							sort={handleSort}
							sortBy={sortBy}
							sortDirection={sortDirection}
							headerRowRenderer={headerRowRenderer}
						>
							{columns
								.filter((col) => col.isVisible)
								.map((col) => (
									<Column
										key={col.dataKey}
										label={col.label}
										dataKey={col.dataKey}
										width={col.width}
										cellRenderer={col.cellRenderer}
									/>
								))}
						</Table>
					)}
				</AutoSizer>
			</TableContainer>
		</>
	);
};

export default DataTable;
