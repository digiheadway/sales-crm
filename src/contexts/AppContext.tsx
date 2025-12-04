import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { toast } from "react-toastify";
import { Lead, Todo, FilterOption } from "../types";
import {
  stageOptions,
  priorityOptions,
  sourceOptions,
  Option,
  getOptionByApiValue,
  getApiValue,
} from "../data/options";

export interface AppOptions {
  preferredLocation: Option[];
  preferredSize: Option[];
  propertyType: Option[];
  tags: Option[];
  assignedTo: Option[];
  participants: Option[];
  lists: Option[];
}

interface AppContextType {
  leads: Lead[];
  todos: Todo[];
  leadFilters: FilterOption[];
  todoFilters: FilterOption[];
  activeLeadId: number | null;
  isLoading: boolean;
  error: string | null;
  addLead: (
    lead: Omit<Lead, "id" | "createdAt" | "updatedAt">
  ) => Promise<void>;
  updateLead: (id: number, lead: Partial<Lead>) => Promise<void>;
  deleteLead: (id: number) => void;
  togglePipelineStatus: (id: number, isInPipeline: boolean) => Promise<void>;
  addTodo: (
    todo: Omit<Todo, "id" | "createdAt" | "updatedAt">
  ) => Promise<void>;
  updateTodo: (id: number, todo: Partial<Todo>) => Promise<void>;
  deleteTodo: (id: number) => void;
  setLeadFilters: (filters: FilterOption[]) => void;
  setTodoFilters: (filters: FilterOption[]) => void;
  removeLeadFilter: (index: number) => void;
  removeTodoFilter: (index: number) => void;
  clearLeadFilters: () => void;
  clearTodoFilters: () => void;
  setActiveLeadId: (id: number | null) => void;
  getFilteredLeads: () => Lead[];
  getFilteredTodos: () => Todo[];
  getLeadById: (id: number) => Lead | undefined;
  getTodosByLeadId: (leadId: number) => Todo[];
  fetchLeads: (params?: {
    page?: number;
    perPage?: number;
    sortField?: string;
    sortOrder?: "asc" | "desc";
    search?: string;
    currentFilters?: FilterOption[];
  }) => Promise<{ data: Lead[]; total: number }>;
  fetchSingleLead: (id: number) => Promise<Lead | null>;
  fetchTodos: (params?: {
    type?: string;
    page?: number;
    perPage?: number;
    sortOrder?: "asc" | "desc";
  }) => Promise<void>;
  invalidateLeadsCache: () => void;
  options: AppOptions;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const FETCH_API_URL = "https://digiheadway.in/back/fetch.php";
const MODIFY_API_URL = "https://digiheadway.in/back/modify.php";
const OPTIONS_API_URL = "https://prop.digiheadway.in/api/v3/options.php";

export const AppProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [leadFilters, setLeadFiltersState] = useState<FilterOption[]>([]);
  const [todoFilters, setTodoFiltersState] = useState<FilterOption[]>([]);
  const [activeLeadId, setActiveLeadId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<AppOptions>({
    preferredLocation: [],
    preferredSize: [],
    propertyType: [],
    tags: [],
    assignedTo: [],
    participants: [],
    lists: [],
  });

  // Global cache for leads data that persists across component re-mounts
  const globalLeadsCache = useRef<{
    data: Lead[];
    params: any;
    timestamp: number;
    total?: number;
  }>({
    data: [],
    params: null,
    timestamp: 0
  });

  // Request deduplication
  const activeRequests = useRef<Map<string, Promise<any>>>(new Map());

  // Create a unique key for request deduplication
  const createRequestKey = (type: string, params: any) => {
    return `${type}-${JSON.stringify(params)}`;
  };

  // Generic request handler with deduplication
  const makeRequest = async <T,>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> => {
    if (activeRequests.current.has(key)) {
      return activeRequests.current.get(key);
    }

    const promise = requestFn().finally(() => {
      activeRequests.current.delete(key);
    });

    activeRequests.current.set(key, promise);
    return promise;
  };

  const transformApiLeadToLead = (apiLead: any): Lead => {
    const id = parseInt(apiLead.id);
    const name = apiLead.name || "";
    const phone = apiLead.phone || "";
    const alternatePhone = apiLead.alter_contact || apiLead.alternative_contact_details || apiLead.alternate_phone || "";
    const address = apiLead.address || "";
    const about = apiLead.about || apiLead.about_him || "";
    const note = apiLead.note || "";
    const budget = parseInt(apiLead.budget) || 0;

    let stage: any = apiLead.stage;
    if (!stageOptions.some(opt => opt.value === stage)) {
      stage = getOptionByApiValue(stageOptions, stage)?.value || "Fresh Lead";
    }

    let priority: any = apiLead.priority;
    if (!priorityOptions.some(opt => opt.value === priority)) {
      priority = getOptionByApiValue(priorityOptions, priority)?.value || "General";
    }

    let customFields = {};
    if (apiLead.custom_fields) {
      try {
        customFields = JSON.parse(apiLead.custom_fields);
      } catch (e) {
        // If not JSON, ignore
      }
    }

    return {
      id,
      isInPipeline: apiLead.is_in_pipeline == 1,
      name,
      phone,
      alternatePhone,
      address,
      labels: apiLead.labels ? apiLead.labels.split(",") : [],
      stage,
      priority,
      requirement: apiLead.requirement || "",
      budget,
      about,
      note,
      listName: apiLead.listname || "",
      source: apiLead.source || "Other",
      customFields,
      type: apiLead.type || "lead",
      assignedTo: apiLead.assignd_to || "",
      adminId: parseInt(apiLead.admin_id) || 0,
      email: apiLead.email || "",
      leadScore: parseInt(apiLead.lead_scrore) || 0,
      lastNote: apiLead.last_note || "",
      createdAt: apiLead.created_at,
      updatedAt: apiLead.updated_at,
    };
  };

  const fetchTodos = useCallback(
    async (
      params: {
        type?: string;
        page?: number;
        perPage?: number;
        sortOrder?: "asc" | "desc";
      } = {}
    ) => {
      const { type, page = 1, perPage = 20, sortOrder = "desc" } = params;

      const requestKey = createRequestKey("todos", params);

      return makeRequest(requestKey, async () => {
        setIsLoading(true);

        try {
          const queryParams = new URLSearchParams({
            resource: "activities",
            page: page.toString(),
            per_page: perPage.toString(),
            sort_dir: sortOrder.toUpperCase(),
          });

          const response = await fetch(`${FETCH_API_URL}?${queryParams}`);

          if (!response.ok) {
            throw new Error("Failed to fetch tasks");
          }

          const data = await response.json();

          if (data.success) {
            const transformedTodos: Todo[] = data.data.map((task: any) => {
              return {
                id: parseInt(task.id),
                leadId: parseInt(task.contact_id),
                type: task.type === 'activity' ? 'Activity' : 'Todo',
                description: task.note || "",
                responseNote: task.response || "",
                status: task.completed == 1 ? "Completed" : "Pending",
                dateTime: task.time,
                participants: task.assigned_to ? task.assigned_to.split(',') : [],
                createdAt: task.created_at,
                updatedAt: task.updated_at,
              };
            });

            setTodos(transformedTodos);
          }
        } catch (err) {
          console.error("Error fetching tasks:", err);
          toast.error("Failed to fetch tasks");
        } finally {
          setIsLoading(false);
        }
      });
    },
    []
  );

  const fetchLeads = useCallback(
    async (
      params: {
        page?: number;
        perPage?: number;
        sortField?: string;
        sortOrder?: "asc" | "desc";
        search?: string;
        currentFilters?: FilterOption[];
      } = {}
    ): Promise<{ data: Lead[]; total: number }> => {
      const {
        page = 1,
        perPage = 20,
        sortField = "created_at",
        sortOrder = "desc",
        search = "",
        currentFilters = leadFilters,
      } = params;

      const cacheKey = JSON.stringify({
        page,
        perPage,
        sortField,
        sortOrder,
        search,
        filters: currentFilters.sort((a, b) => a.field.localeCompare(b.field))
      });

      const cacheAge = Date.now() - globalLeadsCache.current.timestamp;
      const cacheValid = cacheAge < 2 * 60 * 1000;

      if (
        globalLeadsCache.current.data.length > 0 &&
        globalLeadsCache.current.params === cacheKey &&
        cacheValid
      ) {
        setLeads(globalLeadsCache.current.data);
        return { data: globalLeadsCache.current.data, total: globalLeadsCache.current.total || 0 };
      }

      const requestKey = createRequestKey("leads", params);

      return makeRequest(requestKey, async () => {
        setIsLoading(true);
        setError(null);

        try {
          const queryParams = new URLSearchParams({
            resource: "contacts",
            page: page.toString(),
            per_page: perPage.toString(),
            sort_by: sortField === "created_at" ? "created_at" : sortField,
            sort_dir: sortOrder.toUpperCase(),
          });

          if (search) {
            queryParams.append("q", search);
          }

          currentFilters.forEach((filter) => {
            switch (filter.field) {
              case "stage":
                const stageApiValue = getApiValue(stageOptions, filter.value as string);
                const finalStageValue = stageApiValue === filter.value && !stageOptions.find(opt => opt.value === filter.value)
                  ? "Other"
                  : stageApiValue;
                queryParams.append("stage", finalStageValue);
                break;

              case "priority":
                queryParams.append(
                  "priority",
                  getApiValue(priorityOptions, filter.value as string)
                );
                break;

              case "source":
                queryParams.append(
                  "source",
                  getApiValue(sourceOptions, filter.value as string)
                );
                break;

              case "assignedTo":
                if (Array.isArray(filter.value)) {
                  queryParams.append("assignd_to", filter.value.join(","));
                } else {
                  queryParams.append("assignd_to", filter.value.toString());
                }
                break;

              case "propertyType":
                if (Array.isArray(filter.value)) {
                  queryParams.append("type", filter.value.join(","));
                } else {
                  queryParams.append("type", filter.value.toString());
                }
                break;

              case "budget":
                if (filter.operator === ">=") {
                  queryParams.append("min_budget", filter.value.toString());
                } else if (filter.operator === "<=") {
                  queryParams.append("max_budget", filter.value.toString());
                }
                break;

              case "isInPipeline":
                queryParams.append("is_in_pipeline", filter.value.toString());
                break;
            }
          });

          const response = await fetch(`${FETCH_API_URL}?${queryParams}`);

          if (!response.ok) {
            throw new Error("Failed to fetch leads");
          }

          const apiResponse = await response.json();

          if (apiResponse.success) {
            const transformedLeads: Lead[] = apiResponse.data.map((item: any) =>
              transformApiLeadToLead(item)
            );

            const total = apiResponse.meta?.total || 0;

            globalLeadsCache.current = {
              data: transformedLeads,
              params: cacheKey,
              timestamp: Date.now(),
              total: total
            };

            setLeads(transformedLeads);
            return { data: transformedLeads, total: total };
          } else {
            throw new Error(apiResponse.message || "Failed to fetch leads");
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "An error occurred");
          console.error("Error fetching leads:", err);
          throw err;
        } finally {
          setIsLoading(false);
        }
      });
    },
    [leadFilters]
  );

  const fetchOptions = useCallback(async () => {
    try {
      const response = await fetch(OPTIONS_API_URL);
      if (!response.ok) throw new Error("Failed to fetch options");
      const data = await response.json();

      const createOption = (value: string): Option => ({
        value,
        label: value,
        apiValue: value,
      });

      const newTags = (data.tags || []).map(createOption);
      const newAssignedTo = (data.assigned_to || []).map(createOption);
      const newLists = (data.lists || []).map(createOption);

      setOptions((prev: AppOptions) => ({
        ...prev,
        tags: newTags.length > 0 ? newTags : prev.tags,
        assignedTo: newAssignedTo.length > 0 ? newAssignedTo : prev.assignedTo,
        participants: newAssignedTo.length > 0 ? newAssignedTo : prev.participants,
        lists: newLists,
      }));
    } catch (err) {
      console.error("Error fetching options:", err);
    }
  }, []);

  useEffect(() => {
    fetchTodos();
    fetchOptions();
  }, []);

  const addLead = async (
    lead: Omit<Lead, "id" | "createdAt" | "updatedAt">
  ) => {
    try {
      const apiLead = {
        is_in_pipeline: lead.isInPipeline ? 1 : 0,
        name: lead.name,
        phone: lead.phone,
        alter_contact: lead.alternatePhone,
        address: lead.address,
        labels: lead.labels.join(","),
        stage: getApiValue(stageOptions, lead.stage),
        priority: getApiValue(priorityOptions, lead.priority),
        requirement: lead.requirement,
        budget: lead.budget.toString(),
        about: lead.about,
        note: lead.note,
        listname: lead.listName || "",
        source: getApiValue(sourceOptions, lead.source),
        custom_fields: JSON.stringify(lead.customFields || {}),
        type: lead.type,
        assignd_to: lead.assignedTo,
        admin_id: 1,
        email: lead.email,
        lead_scrore: lead.leadScore,
        last_note: lead.lastNote
      };

      const response = await fetch(`${MODIFY_API_URL}?resource=contacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiLead),
      });

      const data = await response.json();

      if (data.success) {
        invalidateLeadsCache();
        await fetchLeads().then(result => {
          setLeads(result.data);
        });
        setActiveLeadId(parseInt(data.id));
        toast.success("Lead added successfully");
      } else {
        throw new Error(data.message || "Failed to add lead");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to add lead";
      toast.error(errorMessage);
      setError(errorMessage);
      throw err;
    }
  };

  const updateLead = async (id: number, leadUpdate: Partial<Lead>) => {
    try {
      const currentLead = leads.find((lead) => lead.id === id);
      if (!currentLead) {
        throw new Error("Lead not found");
      }

      const hasChanges = Object.entries(leadUpdate).some(([key, value]) => {
        if (Array.isArray(value)) {
          return (
            JSON.stringify(value) !==
            JSON.stringify(currentLead[key as keyof Lead])
          );
        }
        return value !== currentLead[key as keyof Lead];
      });

      if (!hasChanges) {
        return;
      }

      const apiUpdate: any = {
        id: id.toString(),
      };

      if (leadUpdate.isInPipeline !== undefined) apiUpdate.is_in_pipeline = leadUpdate.isInPipeline ? 1 : 0;
      if (leadUpdate.name !== undefined) apiUpdate.name = leadUpdate.name;
      if (leadUpdate.phone !== undefined) apiUpdate.phone = leadUpdate.phone;
      if (leadUpdate.alternatePhone !== undefined)
        apiUpdate.alter_contact = leadUpdate.alternatePhone;
      if (leadUpdate.address !== undefined)
        apiUpdate.address = leadUpdate.address;
      if (leadUpdate.labels !== undefined)
        apiUpdate.labels = leadUpdate.labels.join(",");
      if (leadUpdate.stage !== undefined)
        apiUpdate.stage = getApiValue(stageOptions, leadUpdate.stage);
      if (leadUpdate.priority !== undefined)
        apiUpdate.priority = getApiValue(priorityOptions, leadUpdate.priority);
      if (leadUpdate.requirement !== undefined)
        apiUpdate.requirement = leadUpdate.requirement;
      if (leadUpdate.budget !== undefined)
        apiUpdate.budget = leadUpdate.budget.toString();
      if (leadUpdate.about !== undefined)
        apiUpdate.about = leadUpdate.about;
      if (leadUpdate.note !== undefined) apiUpdate.note = leadUpdate.note;
      if (leadUpdate.listName !== undefined)
        apiUpdate.listname = leadUpdate.listName;
      if (leadUpdate.source !== undefined)
        apiUpdate.source = getApiValue(sourceOptions, leadUpdate.source);
      if (leadUpdate.customFields !== undefined) {
        apiUpdate.custom_fields = JSON.stringify({
          ...currentLead.customFields,
          ...leadUpdate.customFields
        });
      }
      if (leadUpdate.type !== undefined)
        apiUpdate.type = leadUpdate.type;
      if (leadUpdate.assignedTo !== undefined)
        apiUpdate.assignd_to = leadUpdate.assignedTo;
      if (leadUpdate.email !== undefined)
        apiUpdate.email = leadUpdate.email;
      if (leadUpdate.leadScore !== undefined)
        apiUpdate.lead_scrore = leadUpdate.leadScore;
      if (leadUpdate.lastNote !== undefined)
        apiUpdate.last_note = leadUpdate.lastNote;

      const response = await fetch(`${MODIFY_API_URL}?resource=contacts&id=${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiUpdate),
      });

      const data = await response.json();

      if (data.success) {
        const updatedLead = {
          ...currentLead,
          ...leadUpdate,
          updatedAt: new Date().toISOString(),
        };

        setLeads(leads.map((lead) => (lead.id === id ? updatedLead : lead)));

        if (activeLeadId !== id) {
          invalidateLeadsCache();
        } else {
          invalidateLeadsCache({ skipEvent: true });
        }

        toast.success("Lead updated successfully");
      } else {
        throw new Error(data.message || "Failed to update lead");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update lead";
      toast.error(errorMessage);
      setError(errorMessage);
      throw err;
    }
  };

  const deleteLead = async (id: number) => {
    try {
      const response = await fetch(`${MODIFY_API_URL}?resource=contacts&id=${id}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (data.success) {
        setLeads(leads.filter((lead) => lead.id !== id));
        setTodos(todos.filter((todo) => todo.leadId !== id));
        if (activeLeadId === id) {
          setActiveLeadId(null);
        }
        toast.success("Lead deleted successfully");
      } else {
        toast.error(data.message || "Failed to delete lead");
      }
    } catch (err) {
      console.error("Error deleting lead:", err);
      toast.error("Failed to delete lead");
    }
  };

  const togglePipelineStatus = async (id: number, isInPipeline: boolean) => {
    try {
      await updateLead(id, { isInPipeline });
    } catch (err) {
      console.error("Error toggling pipeline status:", err);
      throw err;
    }
  };

  const addTodo = async (
    todo: Omit<Todo, "id" | "createdAt" | "updatedAt">
  ) => {
    try {
      const apiTodo = {
        contact_id: todo.leadId.toString(),
        type: todo.type === 'Activity' ? 'activity' : 'task',
        note: todo.description,
        response: todo.responseNote,
        completed: todo.status === 'Completed' ? 1 : 0,
        time: todo.dateTime,
        assigned_to: todo.participants.join(','),
      };

      const response = await fetch(`${MODIFY_API_URL}?resource=activities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiTodo),
      });

      const data = await response.json();

      if (data.success) {
        await fetchTodos();
        toast.success("Task added successfully");
      } else {
        throw new Error(data.message || "Failed to add task");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to add task";
      toast.error(errorMessage);
      setError(errorMessage);
      throw err;
    }
  };

  const updateTodo = async (id: number, todoUpdate: Partial<Todo>) => {
    try {
      const apiUpdate: any = {
        id: id.toString(),
      };

      if (todoUpdate.type !== undefined)
        apiUpdate.type = todoUpdate.type === 'Activity' ? 'activity' : 'task';

      if (todoUpdate.description !== undefined)
        apiUpdate.note = todoUpdate.description;
      if (todoUpdate.responseNote !== undefined)
        apiUpdate.response = todoUpdate.responseNote;
      if (todoUpdate.status !== undefined)
        apiUpdate.completed = todoUpdate.status === 'Completed' ? 1 : 0;
      if (todoUpdate.dateTime !== undefined)
        apiUpdate.time = todoUpdate.dateTime;
      if (todoUpdate.participants !== undefined)
        apiUpdate.assigned_to = todoUpdate.participants.join(',');

      const response = await fetch(`${MODIFY_API_URL}?resource=activities&id=${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiUpdate),
      });

      const data = await response.json();

      if (data.success) {
        setTodos(
          todos.map((todo) =>
            todo.id === id
              ? { ...todo, ...todoUpdate, updatedAt: new Date().toISOString() }
              : todo
          )
        );
        toast.success("Task updated successfully");
      } else {
        throw new Error(data.message || "Failed to update task");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update task";
      toast.error(errorMessage);
      setError(errorMessage);
      throw err;
    }
  };

  const deleteTodo = async (id: number) => {
    try {
      const response = await fetch(`${MODIFY_API_URL}?resource=activities&id=${id}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (data.success) {
        setTodos(todos.filter((todo) => todo.id !== id));
        toast.success("Task deleted successfully");
      } else {
        toast.error(data.message || "Failed to delete task");
      }
    } catch (err) {
      console.error("Error deleting task:", err);
      toast.error("Failed to delete task");
    }
  };

  const setLeadFilters = (newFilters: FilterOption[]) => {
    setLeadFiltersState(newFilters);
  };

  const setTodoFilters = (newFilters: FilterOption[]) => {
    setTodoFiltersState(newFilters);
  };

  const removeLeadFilter = (index: number) => {
    const newFilters = [...leadFilters];
    newFilters.splice(index, 1);
    setLeadFiltersState(newFilters);
  };

  const removeTodoFilter = (index: number) => {
    const newFilters = [...todoFilters];
    newFilters.splice(index, 1);
    setTodoFiltersState(newFilters);
  };

  const clearLeadFilters = () => {
    setLeadFiltersState([]);
  };

  const clearTodoFilters = () => {
    setTodoFiltersState([]);
  };

  const getFilteredLeads = () => {
    return leads;
  };

  const getFilteredTodos = () => {
    return todos;
  };

  const getLeadById = (id: number) => {
    return leads.find((lead) => lead.id === id);
  };

  const getTodosByLeadId = (leadId: number) => {
    return todos.filter((todo) => todo.leadId === leadId);
  };

  const fetchSingleLead = async (id: number): Promise<Lead | null> => {
    const existingLead = leads.find(l => l.id === id);
    if (existingLead) return existingLead;

    try {
      const response = await fetch(`${FETCH_API_URL}?resource=contacts&id=${id}`);
      if (!response.ok) throw new Error("Failed to fetch lead");
      const data = await response.json();

      if (data.success && data.data && data.data.length > 0) {
        const lead = transformApiLeadToLead(data.data[0]);
        return lead;
      }
      return null;
    } catch (err) {
      console.error("Error fetching single lead:", err);
      return null;
    }
  };

  const invalidateLeadsCache = (options?: { skipEvent?: boolean }) => {
    globalLeadsCache.current = {
      data: [],
      params: null,
      timestamp: 0
    };
    activeRequests.current.clear();

    if (!options?.skipEvent) {
      window.dispatchEvent(new CustomEvent('leads-cache-invalidated'));
    }
  };

  const contextValue: AppContextType = {
    leads,
    todos,
    leadFilters,
    todoFilters,
    activeLeadId,
    isLoading,
    error,
    addLead,
    updateLead,
    deleteLead,
    togglePipelineStatus,
    addTodo,
    updateTodo,
    deleteTodo,
    getFilteredLeads,
    getFilteredTodos,
    getLeadById,
    getTodosByLeadId,
    setLeadFilters,
    setTodoFilters,
    clearLeadFilters,
    clearTodoFilters,
    removeLeadFilter,
    removeTodoFilter,
    setActiveLeadId,
    fetchLeads,
    fetchSingleLead,
    fetchTodos,
    invalidateLeadsCache,
    options,
  };

  return (
    <AppContext.Provider
      value={contextValue}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};
