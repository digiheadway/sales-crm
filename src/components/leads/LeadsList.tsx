import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone,
  MessageSquare,
  Filter,
  Plus,
  X,
  ArrowUp,
  ArrowDown,
  Copy,
} from 'lucide-react';
import { useAppContext } from '../../contexts/AppContext';
import LeadFilterModal from './LeadFilterModal';
import AddLeadModal from './AddLeadModal';
import Badge from '../ui/Badge';
import { usePersistentState } from '../../hooks/usePersistentState';
import { useOptimizedDataFetching } from '../../hooks/useOptimizedDataFetching';
import { useColumnSettings } from '../../hooks/useColumnSettings';
import { Lead } from '../../types';
import { dropdownOptions } from '../../data/options';
import Dropdown from '../common/Dropdown';
import TagInput from '../common/TagInput';
import ColumnSettingsModal from './ColumnSettingsModal';
import { getWhatsAppUrl } from '../../utils/phone';

type SortField = 'id' | 'name' | 'budget' | 'stage' | 'created_at';


interface LeadsListProps {
  isInPipeline?: boolean;
}

const LeadsList: React.FC<LeadsListProps> = ({ isInPipeline }) => {
  const {
    leadFilters,
    clearLeadFilters,
    removeLeadFilter,
    fetchLeads,
    getTodosByLeadId,
    setLeadFilters,
    options
  } = useAppContext();

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false);
  const [totalLeads, setTotalLeads] = useState(0);
  const navigate = useNavigate();

  // Desktop filter states
  const [desktopStage, setDesktopStage] = useState('');
  const [desktopTags, setDesktopTags] = useState<string[]>([]);


  // Use persistent state for leads section
  // Use different keys for pipelines and leads to maintain separate states
  const { state, updateState, clearAll, updateFilters } = usePersistentState(isInPipeline ? 'pipelines' : 'leads');
  const { currentPage, sortField, sortDirection, searchQuery, filters: savedFilters } = state;

  // Use column settings
  const {
    columns: columnConfigs,
    updateColumns,
    isModalOpen: isColumnSettingsModalOpen,
    openModal: openColumnSettingsModal,
    closeModal: closeColumnSettingsModal,
    getVisibleColumns,
  } = useColumnSettings();

  // Use optimized data fetching with caching
  const {
    data: cachedLeads,
    isLoading: isDataLoading,
    fetchData,
    clearCache
  } = useOptimizedDataFetching<{ data: Lead[]; total: number }>(
    async (params) => {
      // Call fetchLeads and return the actual data from the API
      return await fetchLeads(params);
    },
    { ttl: 2 * 60 * 1000, maxSize: 20 } // 2 minutes cache
  );

  const leads = cachedLeads?.data || [];
  const total = cachedLeads?.total || 0;
  const totalPages = Math.ceil(total / 20);

  // Update total leads when cached data changes
  useEffect(() => {
    if (cachedLeads?.total !== undefined) {
      setTotalLeads(cachedLeads.total);
    }
  }, [cachedLeads?.total]);

  const hasInitialData = React.useRef(false);
  const prevFiltersRef = React.useRef(leadFilters);
  const latestFiltersRef = React.useRef(leadFilters);
  const [isFiltersInitialized, setIsFiltersInitialized] = useState(false);
  const filtersClearedRef = React.useRef(false);
  const lastRequestParams = React.useRef<string>('');
  const lastRequestTime = React.useRef<number>(0);

  // Listen for cache invalidation events
  useEffect(() => {
    const handleCacheInvalidation = () => {
      // Clear the local cache
      clearCache();

      // Force refresh the data only if we're on the leads list page
      // This prevents unnecessary refreshes when on other pages
      if (hasInitialData.current) {
        const effectiveFilters = [...latestFiltersRef.current];
        if (isInPipeline) {
          effectiveFilters.push({ field: 'isInPipeline', operator: '=', value: 1 });
        }

        const params = {
          page: currentPage,
          perPage: 20,
          sortField,
          sortOrder: sortDirection,
          search: searchQuery,
          currentFilters: effectiveFilters,
        };
        fetchData(params, { forceRefresh: true });
      }
    };

    const handleWindowFocus = () => {
      // Refresh data when window gains focus (user returns to tab)
      if (hasInitialData.current) {
        const effectiveFilters = [...latestFiltersRef.current];
        if (isInPipeline) {
          effectiveFilters.push({ field: 'isInPipeline', operator: '=', value: 1 });
        }

        const params = {
          page: currentPage,
          perPage: 20,
          sortField,
          sortOrder: sortDirection,
          search: searchQuery,
          currentFilters: effectiveFilters,
        };
        fetchData(params, { background: true }); // Background refresh to avoid loading state
      }
    };

    const handleVisibilityChange = () => {
      // Refresh data when page becomes visible (user navigates back)
      if (!document.hidden && hasInitialData.current) {
        const effectiveFilters = [...latestFiltersRef.current];
        if (isInPipeline) {
          effectiveFilters.push({ field: 'isInPipeline', operator: '=', value: 1 });
        }

        const params = {
          page: currentPage,
          perPage: 20,
          sortField,
          sortOrder: sortDirection,
          search: searchQuery,
          currentFilters: effectiveFilters,
        };
        fetchData(params, { background: true }); // Background refresh to avoid loading state
      }
    };

    window.addEventListener('leadsCacheInvalidated', handleCacheInvalidation);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('leadsCacheInvalidated', handleCacheInvalidation);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearCache, fetchData, currentPage, sortField, sortDirection, searchQuery]);

  // Save page state before navigation
  const savePageState = useCallback(() => {
    // Save scroll position to session storage
    sessionStorage.setItem('leadsListScrollPosition', window.scrollY.toString());
  }, []);

  // Restore page state after navigation
  const restorePageState = useCallback(() => {
    const savedScrollPosition = sessionStorage.getItem('leadsListScrollPosition');
    if (savedScrollPosition) {
      const scrollPosition = parseInt(savedScrollPosition);
      if (scrollPosition > 0) {
        window.scrollTo(0, scrollPosition);
      }
    }
  }, []);

  // Restore page state on mount if we have data
  useEffect(() => {
    if (leads.length > 0) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        restorePageState();
      }, 50);
    }
  }, [leads.length, restorePageState]);

  // Save page state when component unmounts
  useEffect(() => {
    return () => {
      savePageState();
    };
  }, [savePageState]);

  // Immediately check for cached data on mount
  useEffect(() => {
    if (leads.length > 0) {
      hasInitialData.current = true;
    } else if (isFiltersInitialized) {
      // If no data but filters are initialized, try to get cached data immediately
      const effectiveFilters = [...latestFiltersRef.current];
      if (isInPipeline) {
        effectiveFilters.push({ field: 'isInPipeline', operator: '=', value: 1 });
      }

      const params = {
        page: currentPage,
        perPage: 20,
        sortField,
        sortOrder: sortDirection,
        search: searchQuery,
        currentFilters: effectiveFilters,
      };

      // This will check cache first and return cached data if available
      fetchData(params);
      hasInitialData.current = true;
    }
  }, [leads.length, isFiltersInitialized, currentPage, sortField, sortDirection, searchQuery, fetchData, isInPipeline]);

  // Keep track of the latest filters
  useEffect(() => {
    latestFiltersRef.current = leadFilters;
  }, [leadFilters]);

  // Initialize filters from persistent state on mount
  useEffect(() => {
    if (savedFilters && savedFilters.length > 0 && leadFilters.length === 0) {
      setLeadFilters(savedFilters);
      setIsFiltersInitialized(true);
    } else {
      // Mark as initialized even if no saved filters or if filters already exist
      setIsFiltersInitialized(true);
    }
  }, []); // Empty dependency array - only run once on mount

  // Sync filters to persistent state when they change
  useEffect(() => {
    const prevFilters = prevFiltersRef.current;
    if (JSON.stringify(prevFilters) !== JSON.stringify(leadFilters)) {
      // Check if filters were cleared
      const filtersCleared = prevFilters.length > 0 && leadFilters.length === 0;
      if (filtersCleared) {
        filtersClearedRef.current = true;
      }

      // Reset last request params when filters change significantly
      lastRequestParams.current = '';

      // Update persistent state with new filters
      updateFilters(leadFilters);
      prevFiltersRef.current = leadFilters;
      // Mark filters as initialized when they change
      setIsFiltersInitialized(true);
    }
  }, [leadFilters, updateFilters]);

  // Data fetching effect - only run after filters are initialized
  useEffect(() => {
    // Don't fetch data until filters are properly initialized
    if (!isFiltersInitialized) {
      return;
    }

    // Use shorter delay for filter changes to prevent lag
    const delay = leadFilters.length > 0 ? 100 : 300;

    const handler = setTimeout(() => {
      const effectiveFilters = [...latestFiltersRef.current];
      if (isInPipeline) {
        effectiveFilters.push({ field: 'isInPipeline', operator: '=', value: 1 });
      }

      const params = {
        page: currentPage,
        perPage: 20,
        sortField,
        sortOrder: sortDirection,
        search: searchQuery,
        currentFilters: effectiveFilters, // Use effective filters
      };

      // Create a unique key for this request
      const requestKey = JSON.stringify(params);

      // Prevent duplicate requests with the same parameters
      if (lastRequestParams.current === requestKey) {
        return;
      }

      // Debounce: prevent requests that are too close together
      const now = Date.now();
      if (now - lastRequestTime.current < 500) { // 500ms minimum between requests
        return;
      }

      lastRequestParams.current = requestKey;
      lastRequestTime.current = now;

      fetchData(params);
      hasInitialData.current = true;
    }, delay);

    return () => clearTimeout(handler);
  }, [currentPage, sortField, sortDirection, searchQuery, leadFilters, fetchData, isFiltersInitialized]);

  const handleSort = useCallback((field: SortField) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    updateState({
      sortField: field,
      sortDirection: newDirection,
      currentPage: 1
    });
  }, [sortField, sortDirection, updateState]);

  const handleLeadClick = useCallback((leadId: number) => {
    savePageState();
    navigate(`/leads/${leadId}`);
  }, [navigate, savePageState]);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    updateState({
      searchQuery: value,
      currentPage: 1
    });
  }, [updateState]);

  const handlePageChange = useCallback((newPage: number) => {
    updateState({ currentPage: newPage });
  }, [updateState]);





  const handleClearAll = useCallback(() => {
    clearLeadFilters();
    clearAll();
    // Clear global cache to force fresh data fetch
    // globalLeadsCache.current = []; // This line is removed
    // Force refresh data when all filters are cleared
    if (hasInitialData.current) {
      const effectiveFilters: any[] = [];
      if (isInPipeline) {
        effectiveFilters.push({ field: 'isInPipeline', operator: '=', value: 1 });
      }

      const params = {
        page: currentPage,
        perPage: 20,
        sortField,
        sortOrder: sortDirection,
        searchQuery: '',
        currentFilters: effectiveFilters,
      };
      fetchData(params, { forceRefresh: true });
    }
  }, [clearLeadFilters, clearAll, currentPage, sortField, sortDirection, fetchData, isInPipeline]);





  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />;
  };

  const renderTableHeader = (columnId: string, label: string) => {
    const sortableFields: SortField[] = ['id', 'name', 'budget', 'stage', 'created_at'];
    const isSortable = sortableFields.includes(columnId as SortField);

    if (!isSortable) {
      return (
        <th className="table-header">
          {label}
        </th>
      );
    }

    return (
      <th
        className="table-header cursor-pointer"
        onClick={() => handleSort(columnId as SortField)}
      >
        <div className="flex items-center">
          {label} {renderSortIcon(columnId as SortField)}
        </div>
      </th>
    );
  };

  const renderTableCell = (lead: Lead, columnId: string) => {
    switch (columnId) {
      case 'id':
        return <td className="table-cell font-medium">{lead.id}</td>;
      case 'name':
        return (
          <td className="table-cell font-medium text-gray-700 truncate max-w-[150px]">
            {lead.name}
          </td>
        );
      case 'budget':
        return <td className="table-cell">{lead.budget}L</td>;
      case 'stage':
        return (
          <td className="table-cell">
            <Badge
              label={lead.stage}
              className="table-cell max-w-[150px] truncate"
              color={
                lead.stage.includes('Init') ? 'blue' :
                  lead.stage.includes('Mid') ? 'purple' :
                    lead.stage.includes('Mat') ? 'green' :
                      lead.stage.includes('Deal') ? 'yellow' :
                        lead.stage.includes('Neg') ? 'red' :
                          'gray'
              }
            />
          </td>
        );
      case 'labels':
        return (
          <td className="table-cell">
            <div className="flex items-center space-x-1 truncate">
              {lead.labels.length > 0 ? (
                <span className="text-sm text-gray-600">
                  {lead.labels.slice(0, 2).join(', ')}
                  {lead.labels.length > 2 && ` +${lead.labels.length - 2}`}
                </span>
              ) : (
                <span className="text-sm text-gray-400">No labels</span>
              )}
            </div>
          </td>
        );
      case 'tasks':
        return (
          <td className="table-cell text-center">
            <Badge
              label={`${getTodosByLeadId(lead.id).length}`}
              color="blue"
            />
          </td>
        );
      case 'note':
        return (
          <td className="table-cell truncate max-w-[220px]">
            {lead.note || '—'}
          </td>
        );
      case 'about':
        return (
          <td className="table-cell truncate max-w-[200px]">
            {lead.about || '—'}
          </td>
        );
      case 'address':
        return (
          <td className="table-cell truncate max-w-[200px]">
            {lead.address || '—'}
          </td>
        );
      case 'priority':
        return (
          <td className="table-cell">
            <Badge
              label={lead.priority}
              color={
                lead.priority === 'Super High' ? 'red' :
                  lead.priority === 'High' ? 'orange' :
                    lead.priority === 'Focus' ? 'yellow' :
                      lead.priority === 'General' ? 'blue' :
                        lead.priority === 'Low' ? 'green' :
                          'gray'
              }
            />
          </td>
        );

      case 'assignedTo':
        return (
          <td className="table-cell truncate max-w-[200px]">
            {lead.assignedTo || '—'}
          </td>
        );
      case 'type':
        return (
          <td className="table-cell">
            <div className="flex items-center space-x-1 truncate">
              <span className="text-sm text-gray-600">
                {lead.type || 'Any'}
              </span>
            </div>
          </td>
        );
      case 'requirements':
        return (
          <td className="table-cell truncate max-w-[200px]">
            {lead.requirement || 'No description provided'}
          </td>
        );
      case 'actions':
        return (
          <td className="table-cell">
            <div className="flex space-x-2">
              <button
                className="p-1 text-gray-600 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-colors duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`tel:${lead.phone}`);
                }}
                title="Call"
              >
                <Phone size={16} />
              </button>
              <button
                className="p-1 text-gray-600 hover:text-green-600 rounded-full hover:bg-green-50 transition-colors duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(getWhatsAppUrl(lead.phone));
                }}
                title="WhatsApp"
              >
                <MessageSquare size={16} />
              </button>
              <button
                className="p-1 text-gray-600 hover:text-purple-600 rounded-full hover:bg-purple-50 transition-colors duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  copyPhoneNumber(lead.phone);
                }}
                title="Copy phone number"
              >
                <Copy size={16} />
              </button>
            </div>
          </td>
        );
      default:
        return <td className="table-cell">—</td>;
    }
  };

  // Handle desktop filter changes
  const handleDesktopStageChange = useCallback((value: string) => {
    setDesktopStage(value);

    // Update filters
    const newFilters = leadFilters.filter(filter => filter.field !== 'stage');
    if (value) {
      newFilters.push({ field: 'stage', operator: '=', value });
    }
    setLeadFilters(newFilters);
  }, [leadFilters, setLeadFilters]);

  const handleDesktopTagsChange = useCallback((tags: string[]) => {
    setDesktopTags(tags);

    // Update filters
    const newFilters = leadFilters.filter(filter => filter.field !== 'labels');
    if (tags.length > 0) {
      newFilters.push({ field: 'labels', operator: '=', value: tags });
    }
    setLeadFilters(newFilters);
  }, [leadFilters, setLeadFilters]);



  // Sync desktop filters with leadFilters
  useEffect(() => {
    const stageFilter = leadFilters.find(filter => filter.field === 'stage');
    const tagsFilter = leadFilters.find(filter => filter.field === 'labels');

    if (stageFilter) {
      setDesktopStage(stageFilter.value as string);
    } else {
      setDesktopStage('');
    }

    if (tagsFilter) {
      setDesktopTags(Array.isArray(tagsFilter.value) ? tagsFilter.value : [tagsFilter.value as string]);
    } else {
      setDesktopTags([]);
    }
  }, [leadFilters]);

  const handleAddLeadModalClose = useCallback(() => {
    setIsAddLeadModalOpen(false);
    // Force refresh data when modal is closed
    if (hasInitialData.current) {
      const effectiveFilters = [...latestFiltersRef.current];
      if (isInPipeline) {
        effectiveFilters.push({ field: 'isInPipeline', operator: '=', value: 1 });
      }

      const params = {
        page: currentPage,
        perPage: 20,
        sortField,
        sortOrder: sortDirection,
        search: searchQuery,
        currentFilters: effectiveFilters,
      };
      fetchData(params, { forceRefresh: true });
    }
  }, [currentPage, sortField, sortDirection, searchQuery, fetchData, isInPipeline]);

  const copyPhoneNumber = async (phoneNumber: string) => {
    try {
      await navigator.clipboard.writeText(phoneNumber);
    } catch (err) {
      // Silent fail - no user feedback needed
    }
  };

  // Expose column settings modal to parent component
  React.useEffect(() => {
    const handleOpenColumnSettings = () => {
      openColumnSettingsModal();
    };

    window.addEventListener('openColumnSettings', handleOpenColumnSettings);
    return () => {
      window.removeEventListener('openColumnSettings', handleOpenColumnSettings);
    };
  }, [openColumnSettingsModal]);

  return (
    <>
      <div className="p-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div className="flex flex-col md:flex-row mt-4 md:mt-0 space-y-2 md:space-y-0 md:space-x-2 w-full">
            {/* Search and buttons row - always on same line */}
            <div className="flex items-center space-x-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <input
                  type="text"
                  placeholder="Search leads..."
                  className="input pr-10 w-full"
                  value={searchQuery || ''}
                  onChange={handleSearch}
                />
              </div>

              <div className="flex space-x-2 flex-shrink-0">
                <button
                  className="btn btn-outline flex items-center h-10 px-3"
                  onClick={() => setIsFilterModalOpen(true)}
                >
                  <Filter size={16} />
                </button>

                <button
                  className="btn btn-primary flex items-center h-10 px-3"
                  onClick={() => setIsAddLeadModalOpen(true)}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Desktop-only filters in same line */}
            <div className="hidden md:flex md:space-x-2 md:flex-1">
              <div className="flex-1 max-w-xs">
                <Dropdown
                  options={dropdownOptions.stage}
                  value={desktopStage}
                  onChange={handleDesktopStageChange}
                  placeholder="All Stages"
                />
              </div>
              <div className="flex-1 max-w-xs">
                <TagInput
                  options={options.tags}
                  value={desktopTags}
                  onChange={handleDesktopTagsChange}
                  placeholder="Select labels..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Desktop-only filter section - removed since moved to top line */}

        {leadFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4 p-2 bg-gray-50 rounded-md">
            <span className="text-sm font-medium text-gray-600">
              Active Filters:
            </span>
            {leadFilters.map((filter, index) => (
              <Badge
                key={index}
                label={`${filter.field}: ${filter.value}`}
                color="gray"
                onClose={() => removeLeadFilter(index)}
              />
            ))}
            <button
              className="text-sm text-red-600 hover:text-red-800 flex items-center"
              onClick={handleClearAll}
            >
              <X size={14} className="mr-1" />
              Clear All
            </button>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  {getVisibleColumns().map((column) => (
                    <React.Fragment key={column.id}>
                      {renderTableHeader(column.id, column.label)}
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leads.length === 0 ? (
                  <tr>
                    <td
                      colSpan={getVisibleColumns().length}
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      {searchQuery
                        ? 'No leads found matching your search criteria'
                        : 'No leads found. Add your first lead to get started!'}
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="hover:bg-gray-50 cursor-pointer transition-all duration-200 ease-in-out"
                      onClick={() => handleLeadClick(lead.id)}
                    >
                      {getVisibleColumns().map((column) => (
                        <React.Fragment key={column.id}>
                          {renderTableCell(lead, column.id)}
                        </React.Fragment>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {(leads.length > 0 || totalLeads > 0) && totalPages > 0 && (
            <div className="bg-gray-50 py-3 px-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalPages} ({totalLeads} leads)
              </div>
              <div className="flex space-x-1">
                <button
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1 || isDataLoading}
                  className="btn btn-outline py-1 px-3 disabled:opacity-50 transition-opacity duration-200"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages || isDataLoading}
                  className="btn btn-outline py-1 px-3 disabled:opacity-50 transition-opacity duration-200"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <LeadFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
      />

      <AddLeadModal
        isOpen={isAddLeadModalOpen}
        onClose={handleAddLeadModalClose}
      />

      <ColumnSettingsModal
        isOpen={isColumnSettingsModalOpen}
        onClose={closeColumnSettingsModal}
        columns={columnConfigs}
        onColumnsChange={updateColumns}
      />
    </>
  );
};

export default LeadsList;