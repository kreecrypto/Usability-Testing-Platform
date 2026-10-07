'use client';
import * as React from 'react';
import * as Primitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/ui';
export const Tabs=Primitive.Root;
export const TabsList=React.forwardRef<React.ComponentRef<typeof Primitive.List>,React.ComponentPropsWithoutRef<typeof Primitive.List>>(function TabsList({className,...props},ref){return <Primitive.List {...props} ref={ref} data-ui="tabs-list" className={cn('tw:flex tw:flex-wrap tw:gap-ah-8',className)}/>;});
export const TabsTrigger=React.forwardRef<React.ComponentRef<typeof Primitive.Trigger>,React.ComponentPropsWithoutRef<typeof Primitive.Trigger>>(function TabsTrigger({className,...props},ref){return <Primitive.Trigger {...props} ref={ref} data-ui="tabs-trigger" className={cn('tw:min-h-[var(--ah-button-md-height)] tw:rounded-ah-sm tw:border tw:border-solid tw:border-hairline tw:bg-canvas tw:px-ah-16 tw:text-ink tw:data-[state=active]:bg-primary tw:data-[state=active]:text-on-primary tw:focus-visible:outline-2 tw:focus-visible:outline-primary',className)}/>;});
export const TabsContent=Primitive.Content;
